/**
 * TenantSettings repository
 *
 * Provides data access for tenant settings entities.
 */

import type { PrismaClient, TenantSettings } from '@prisma/client';
import { BaseRepository } from './base.js';

/**
 * Input for creating tenant settings
 */
export interface CreateTenantSettingsInput {
  /** Tenant ID */
  tenantId: string;
  /** Brand name */
  brandName?: string | undefined;
  /** Brand logo URL */
  brandLogo?: string | null | undefined;
  /** Primary color (hex) */
  primaryColor?: string | undefined;
  /** Notification email */
  notificationEmail?: string | null | undefined;
  /** Auto-assign tasks */
  taskAutoAssignment?: boolean | undefined;
  /** Default SLA duration */
  defaultSLADuration?: string | undefined;
}

/**
 * Input for updating tenant settings
 */
export interface UpdateTenantSettingsInput {
  /** Brand name */
  brandName?: string | null | undefined;
  /** Brand logo URL */
  brandLogo?: string | null | undefined;
  /** Primary color (hex) */
  primaryColor?: string | null | undefined;
  /** Notification email */
  notificationEmail?: string | null | undefined;
  /** Auto-assign tasks */
  taskAutoAssignment?: boolean | undefined;
  /** Default SLA duration */
  defaultSLADuration?: string | undefined;
}

/**
 * Repository for tenant settings data access
 *
 * Note that tenant settings don't use tenant scoping since they
 * are a singleton per tenant accessed directly by tenantId.
 */
export class TenantSettingsRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /**
   * Find tenant settings by tenant ID
   *
   * @param tenantId - Tenant ID
   * @returns Tenant settings or null if not found
   */
  async findByTenantId(tenantId: string): Promise<TenantSettings | null> {
    return this.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });
  }

  /**
   * Find tenant settings by tenant ID, throwing if not found
   *
   * @param tenantId - Tenant ID
   * @returns Tenant settings
   * @throws Error if settings not found
   */
  async findByTenantIdOrThrow(tenantId: string): Promise<TenantSettings> {
    const settings = await this.findByTenantId(tenantId);
    if (!settings) {
      throw new Error(`Tenant settings not found for tenant ${tenantId}`);
    }
    return settings;
  }

  /**
   * Create tenant settings
   *
   * @param input - Settings creation input
   * @returns Created settings
   */
  async create(input: CreateTenantSettingsInput): Promise<TenantSettings> {
    return await this.prisma.tenantSettings.create({
      data: {
        tenantId: input.tenantId,
        brandName: input.brandName ?? 'Orkestra',
        brandLogo: input.brandLogo ?? null,
        primaryColor: input.primaryColor ?? '#06b6d4',
        notificationEmail: input.notificationEmail ?? null,
        taskAutoAssignment: input.taskAutoAssignment ?? false,
        defaultSLADuration: input.defaultSLADuration ?? '24h',
      },
    });
  }

  /**
   * Update tenant settings by tenant ID
   *
   * @param tenantId - Tenant ID
   * @param input - Update input
   * @returns Updated settings
   */
  async update(tenantId: string, input: UpdateTenantSettingsInput): Promise<TenantSettings> {
    return await this.prisma.tenantSettings.update({
      where: { tenantId },
      data: {
        ...(input.brandName !== undefined && { brandName: input.brandName }),
        ...(input.brandLogo !== undefined && { brandLogo: input.brandLogo }),
        ...(input.primaryColor !== undefined && { primaryColor: input.primaryColor }),
        ...(input.notificationEmail !== undefined && {
          notificationEmail: input.notificationEmail,
        }),
        ...(input.taskAutoAssignment !== undefined && {
          taskAutoAssignment: input.taskAutoAssignment,
        }),
        ...(input.defaultSLADuration !== undefined && {
          defaultSLADuration: input.defaultSLADuration,
        }),
      },
    });
  }

  /**
   * Upsert tenant settings (create if not exists, update if exists)
   *
   * @param tenantId - Tenant ID
   * @param input - Settings input
   * @returns Created or updated settings
   */
  async upsert(
    tenantId: string,
    input: Omit<UpdateTenantSettingsInput, 'defaultSLADuration'> & {
      brandName?: string;
      defaultSLADuration?: string;
    }
  ): Promise<TenantSettings> {
    const createData: any = {
      tenantId,
      brandName: input.brandName ?? 'Orkestra',
      brandLogo: input.brandLogo ?? null,
      primaryColor: input.primaryColor ?? '#06b6d4',
      notificationEmail: input.notificationEmail ?? null,
      taskAutoAssignment: input.taskAutoAssignment ?? false,
      defaultSLADuration: input.defaultSLADuration ?? '24h',
    };

    const updateData: any = {
      ...(input.brandName !== undefined && { brandName: input.brandName }),
      ...(input.brandLogo !== undefined && { brandLogo: input.brandLogo }),
      ...(input.primaryColor !== undefined && { primaryColor: input.primaryColor }),
      ...(input.notificationEmail !== undefined && { notificationEmail: input.notificationEmail }),
      ...(input.taskAutoAssignment !== undefined && {
        taskAutoAssignment: input.taskAutoAssignment,
      }),
      ...(input.defaultSLADuration !== undefined && {
        defaultSLADuration: input.defaultSLADuration,
      }),
    };

    return await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: createData,
      update: updateData,
    });
  }

  /**
   * Delete tenant settings
   *
   * @param tenantId - Tenant ID
   * @returns Deleted settings
   */
  async delete(tenantId: string): Promise<TenantSettings> {
    return await this.prisma.tenantSettings.delete({
      where: { tenantId },
    });
  }
}
