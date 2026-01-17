/**
 * Assignment Strategies Module
 *
 * Provides strategies for assigning tasks to users within groups.
 */

import type { PrismaClient, AssignmentStrategy as PrismaAssignmentStrategy } from '@prisma/client';
import type { RequestContext } from '../../context/index.js';
import type { AssignmentTarget, AssignmentStrategyType, ResolvedAssignment } from './types.js';

/**
 * Assignment strategy interface
 *
 * Implementations select a user from a group based on their specific algorithm.
 */
export interface AssignmentStrategy {
  /**
   * Select a user from a group for task assignment
   *
   * @param ctx - Request context
   * @param groupId - Group to select from
   * @param prisma - Prisma client for database access
   * @returns Selected user ID or null if no suitable user found
   */
  selectUser(ctx: RequestContext, groupId: string, prisma: PrismaClient): Promise<string | null>;
}

/**
 * Round-robin assignment strategy
 *
 * Assigns tasks to users in rotation, tracking the last assigned index.
 * This ensures fair distribution of tasks among group members.
 */
export class RoundRobinStrategy implements AssignmentStrategy {
  // Track last assigned index per group (in-memory, resets on restart)
  // For production, this should be stored in the database
  private lastAssignedIndex: Map<string, number> = new Map();

  async selectUser(
    ctx: RequestContext,
    groupId: string,
    prisma: PrismaClient
  ): Promise<string | null> {
    // Get active members of the group
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        group: {
          tenantId: ctx.tenantId,
          deletedAt: null,
          isAssignable: true,
        },
        user: {
          deletedAt: null,
          status: 'active',
        },
      },
      select: {
        userId: true,
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    if (members.length === 0) {
      return null;
    }

    // Get the last assigned index for this group
    const lastIndex = this.lastAssignedIndex.get(groupId) ?? -1;

    // Calculate next index (wrap around)
    const nextIndex = (lastIndex + 1) % members.length;

    // Update last assigned index
    this.lastAssignedIndex.set(groupId, nextIndex);

    const selectedMember = members[nextIndex];
    return selectedMember?.userId ?? null;
  }

  /**
   * Reset the round-robin state for a group
   * Useful for testing or when group membership changes significantly
   *
   * @param groupId - Group ID to reset
   */
  reset(groupId?: string): void {
    if (groupId) {
      this.lastAssignedIndex.delete(groupId);
    } else {
      this.lastAssignedIndex.clear();
    }
  }
}

/**
 * Load-balanced assignment strategy
 *
 * Assigns tasks to the user with the fewest active tasks.
 * This helps distribute workload based on current capacity.
 */
export class LoadBalancedStrategy implements AssignmentStrategy {
  async selectUser(
    ctx: RequestContext,
    groupId: string,
    prisma: PrismaClient
  ): Promise<string | null> {
    // Get active members of the group with their task counts
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        group: {
          tenantId: ctx.tenantId,
          deletedAt: null,
          isAssignable: true,
        },
        user: {
          deletedAt: null,
          status: 'active',
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            _count: {
              select: {
                assignedTasks: {
                  where: {
                    status: {
                      in: ['pending', 'assigned', 'in_progress'],
                    },
                    deletedAt: null,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (members.length === 0) {
      return null;
    }

    // Find the member with the fewest active tasks
    let minTasks = Infinity;
    let selectedUserId: string | null = null;

    for (const member of members) {
      const taskCount = member.user._count.assignedTasks;
      if (taskCount < minTasks) {
        minTasks = taskCount;
        selectedUserId = member.userId;
      }
    }

    return selectedUserId;
  }
}

/**
 * Direct assignment strategy
 *
 * For direct user assignments (no selection needed).
 * Returns null since assignment is direct.
 */
export class DirectStrategy implements AssignmentStrategy {
  async selectUser(): Promise<string | null> {
    // Direct assignments don't need user selection
    return null;
  }
}

/**
 * Map Prisma assignment strategy enum to our type
 */
function mapPrismaStrategy(prismaStrategy: PrismaAssignmentStrategy): AssignmentStrategyType {
  switch (prismaStrategy) {
    case 'round_robin':
      return 'round_robin';
    case 'least_loaded':
      return 'load_balanced';
    case 'manual':
      return 'direct';
    case 'random':
      return 'round_robin'; // Fall back to round_robin for random
    default:
      // Fall back to round_robin for any new enum values
      return 'round_robin';
  }
}

/**
 * Assignment resolver
 *
 * Resolves assignment targets to concrete user/group assignments
 * using the appropriate strategy.
 */
export class AssignmentResolver {
  private strategies: Map<AssignmentStrategyType, AssignmentStrategy>;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient, strategies?: Map<AssignmentStrategyType, AssignmentStrategy>) {
    this.prisma = prisma;
    this.strategies =
      strategies ??
      new Map<AssignmentStrategyType, AssignmentStrategy>([
        ['round_robin', new RoundRobinStrategy()],
        ['load_balanced', new LoadBalancedStrategy()],
        ['direct', new DirectStrategy()],
      ]);
  }

  /**
   * Resolve an assignment target to a concrete assignment
   *
   * @param ctx - Request context
   * @param target - Assignment target (user and/or group)
   * @param strategyType - Strategy to use for group assignments
   * @returns Resolved assignment with user and/or group
   */
  async resolve(
    ctx: RequestContext,
    target: AssignmentTarget,
    strategyType?: AssignmentStrategyType
  ): Promise<ResolvedAssignment> {
    // If direct user assignment, return immediately
    if (target.userId) {
      return {
        userId: target.userId,
        groupId: target.groupId ?? null,
        strategy: 'direct',
      };
    }

    // If no group, return unassigned
    if (!target.groupId) {
      return {
        userId: null,
        groupId: null,
        strategy: 'direct',
      };
    }

    // Get the group's assignment strategy if not specified
    let effectiveStrategy = strategyType;

    if (!effectiveStrategy) {
      const group = await this.prisma.group.findFirst({
        where: {
          id: target.groupId,
          tenantId: ctx.tenantId,
          deletedAt: null,
        },
        select: {
          assignmentStrategy: true,
        },
      });

      if (group) {
        effectiveStrategy = mapPrismaStrategy(group.assignmentStrategy);
      } else {
        effectiveStrategy = 'round_robin';
      }
    }

    // Get the strategy implementation
    const strategy = this.strategies.get(effectiveStrategy);
    if (!strategy) {
      throw new Error(`Unknown assignment strategy: ${effectiveStrategy}`);
    }

    // Select a user from the group
    const selectedUserId = await strategy.selectUser(ctx, target.groupId, this.prisma);

    return {
      userId: selectedUserId,
      groupId: target.groupId,
      strategy: effectiveStrategy,
    };
  }

  /**
   * Register a custom assignment strategy
   *
   * @param type - Strategy type identifier
   * @param strategy - Strategy implementation
   */
  registerStrategy(type: AssignmentStrategyType, strategy: AssignmentStrategy): void {
    this.strategies.set(type, strategy);
  }

  /**
   * Get a strategy by type
   *
   * @param type - Strategy type
   * @returns Strategy implementation or undefined
   */
  getStrategy(type: AssignmentStrategyType): AssignmentStrategy | undefined {
    return this.strategies.get(type);
  }
}

/**
 * Create a default assignment resolver
 *
 * @param prisma - Prisma client
 * @returns Configured assignment resolver
 */
export function createAssignmentResolver(prisma: PrismaClient): AssignmentResolver {
  return new AssignmentResolver(prisma);
}
