# Assignment Strategies

This guide covers task assignment strategies in Orkestra. Learn how to distribute work effectively among users and groups.

## Table of Contents

- [Assignment Basics](#assignment-basics)
- [Assignment Strategies](#assignment-strategies)
- [Groups and Membership](#groups-and-membership)
- [Direct Assignment](#direct-assignment)
- [Group Assignment](#group-assignment)
- [Choosing a Strategy](#choosing-a-strategy)
- [Advanced Patterns](#advanced-patterns)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Assignment Basics

Tasks can be assigned to either individual users or groups of users.

### Direct User Assignment

Assign a task to a specific person:

```typescript
import { task } from '@orkestra/sdk';

const result = await task(ctx, {
  title: 'Review Contract',
  form: {
    /* ... */
  },
  assignTo: { userId: 'usr_abc123' },
});
```

### Group Assignment

Assign a task to a group for any member to pick up:

```typescript
const result = await task(ctx, {
  title: 'Handle Support Ticket',
  form: {
    /* ... */
  },
  assignTo: { group: 'support-l1' },
});
```

---

## Assignment Strategies

When assigning to groups, Orkestra uses strategies to select which user should handle the task.

### Round Robin

Rotates through group members in order. Ensures fair distribution.

```typescript
// Group configured with round_robin strategy
const result = await task(ctx, {
  title: 'Process Payment',
  form: {
    /* ... */
  },
  assignTo: { group: 'finance' },
});
```

**How it works**:

1. Tracks the last assigned user per group
2. Assigns to the next user in the list
3. Wraps around when reaching the end

**Best for**:

- Support teams
- Review queues
- Any team with similar skill levels

### Load Balanced

Assigns to the user with the fewest active tasks.

```typescript
// Group configured with load_balanced (least_loaded) strategy
const result = await task(ctx, {
  title: 'Review PR',
  form: {
    /* ... */
  },
  assignTo: { group: 'developers' },
});
```

**How it works**:

1. Counts active tasks for each member
2. Selects user with lowest count
3. Dynamically adapts to workload

**Best for**:

- Teams with varying task complexity
- When tasks have different completion times
- Preventing burnout during busy periods

### Manual

No automatic assignment. Users must claim tasks from the queue.

```typescript
// Group configured with manual strategy
const result = await task(ctx, {
  title: 'Handle Escalation',
  form: {
    /* ... */
  },
  assignTo: { group: 'support-l2' },
});
```

**How it works**:

1. Tasks appear in all group members' inboxes
2. First user to claim gets the task
3. No automatic distribution

**Best for**:

- Specialized teams where users pick by expertise
- Ad-hoc assignments
- When flexibility is more important than balance

---

## Groups and Membership

### Creating Groups

Groups are created via the API or CLI:

```bash
# Create a group
npx orkestra group create support-l1 \
  --strategy round_robin \
  --description "Level 1 Support Team"
```

### Adding Members

Add users to groups:

```bash
# Add user to group
npx orkestra group member add support-l1 usr_abc123
```

Or via API:

```typescript
await prisma.groupMember.create({
  data: {
    groupId: 'grp_support_l1',
    userId: 'usr_abc123',
  },
});
```

### Group Strategies

Set the assignment strategy when creating a group:

```typescript
await prisma.group.create({
  data: {
    name: 'reviewers',
    slug: 'reviewers',
    tenantId: 'tenant_123',
    assignmentStrategy: 'round_robin', // or 'least_loaded', 'manual'
    isAssignable: true,
  },
});
```

---

## Direct Assignment

### When to Use

Use direct assignment when:

- A specific person is responsible
- Tasks require specialized skills
- One-on-one interactions are needed
- Approval workflows need specific approvers

### Examples

```typescript
// Assign to manager for approval
await task(ctx, {
  title: 'Expense Approval',
  form: { approved: { type: 'boolean' } },
  assignTo: { userId: input.managerId },
});

// Assign to account owner
await task(ctx, {
  title: 'Customer Follow-up',
  form: { notes: { type: 'textarea' } },
  assignTo: { userId: customer.accountOwnerId },
});
```

### Dynamic Assignment

Calculate the assignee at runtime:

```typescript
import { workflow, task } from '@orkestra/sdk';

interface ApprovalInput {
  amount: number;
  requesterId: string;
}

export const approvalWorkflow = workflow<{}, {}>('approval', async (ctx, input: ApprovalInput) => {
  let assigneeId: string;

  // Route to different approvers based on amount
  if (input.amount < 100) {
    assigneeId = 'usr_team_lead';
  } else if (input.amount < 1000) {
    assigneeId = 'usr_manager';
  } else {
    assigneeId = 'usr_director';
  }

  const result = await task(ctx, {
    title: 'Expense Approval',
    form: {
      approved: { type: 'boolean', required: true },
      notes: { type: 'textarea' },
    },
    assignTo: { userId: assigneeId },
  });

  return result.data;
});
```

---

## Group Assignment

### When to Use

Use group assignment when:

- Any qualified team member can handle it
- Workload distribution is important
- Team has overlapping skills
- Coverage is needed 24/7

### Examples

```typescript
// Assign to support team
await task(ctx, {
  title: 'Customer Question',
  form: { answer: { type: 'textarea' } },
  assignTo: { group: 'support-l1' },
});

// Assign to review team
await task(ctx, {
  title: 'Code Review',
  form: { approved: { type: 'boolean' } },
  assignTo: { group: 'reviewers' },
});
```

### Multi-Level Assignment

Start with one group, escalate to another:

```typescript
import { taskWithEscalation, escalationChain } from '@orkestra/sdk';

const result = await taskWithEscalation(ctx, {
  title: 'Handle Escalation',
  form: { resolution: { type: 'textarea' } },
  assignTo: { group: 'support-l1' },
  escalation: escalationChain()
    .escalateAfter('30m', { group: 'support-l2' })
    .escalateAfter('1h', { group: 'managers' })
    .build(),
});
```

---

## Choosing a Strategy

### Decision Tree

```
Is there a specific person who must handle this?
├─ Yes → Direct Assignment
└─ No → Can any team member handle it?
    ├─ Yes → Need workload balancing?
    │   ├─ Yes → Load Balanced
    │   └─ No → Round Robin
    └─ No → Need flexibility?
        └─ Yes → Manual
```

### Strategy Comparison

| Strategy      | Fairness | Load Balance | Flexibility | Best For                 |
| ------------- | -------- | ------------ | ----------- | ------------------------ |
| Round Robin   | High     | Medium       | Low         | Standard support queues  |
| Load Balanced | Medium   | High         | Low         | Variable task complexity |
| Manual        | Low      | Low          | High        | Specialized teams        |

### Examples by Use Case

#### Support Ticket Queue

**Scenario**: General support team, similar skills, high volume

**Strategy**: `round_robin`

```typescript
await task(ctx, {
  title: 'Support Ticket #' + ticketId,
  form: {
    /* ... */
  },
  assignTo: { group: 'support' },
});
```

#### Code Review

**Scenario**: Developers with varying expertise, PRs take different time

**Strategy**: `load_balanced`

```typescript
await task(ctx, {
  title: 'Review PR #' + prNumber,
  form: { approved: { type: 'boolean' } },
  assignTo: { group: 'reviewers' },
});
```

#### On-Call Rotation

**Scenario**: One person on duty at a time, tasks vary widely

**Strategy**: `manual` (with on-call assignment)

```typescript
// Get current on-call person
const onCallPerson = await getOnCallPerson('devops');

await task(ctx, {
  title: 'Production Incident',
  form: {
    /* ... */
  },
  assignTo: { userId: onCallPerson.id },
});
```

---

## Advanced Patterns

### Tiered Assignment

Assign to primary, then escalate:

```typescript
import { taskWithEscalation, escalationChain } from '@orkestra/sdk';

export const tieredApproval = workflow('tiered-approval', async (ctx, input) => {
  const { amount, tiers } = input;

  // Build escalation chain from tiers
  const chain = escalationChain();
  tiers.forEach((tier, index) => {
    chain.escalateAfter(`${(index + 1) * 1}h`, { group: tier.group });
  });

  const result = await taskWithEscalation(ctx, {
    title: `Approval for $${amount}`,
    form: { approved: { type: 'boolean' } },
    assignTo: { group: tiers[0].group },
    escalation: chain.build(),
  });

  return result.data;
});
```

### Skill-Based Routing

Route to group based on required skills:

```typescript
import { workflow, task } from '@orkestra/sdk';

interface RoutingInput {
  issueType: string;
  priority: 'low' | 'medium' | 'high';
}

export const skillBasedRouting = workflow('skill-routing', async (ctx, input: RoutingInput) => {
  let group: string;

  // Route based on issue type
  switch (input.issueType) {
    case 'technical':
      group = input.priority === 'high' ? 'technical-l2' : 'technical-l1';
      break;
    case 'billing':
      group = 'billing';
      break;
    case 'account':
      group = 'account-management';
      break;
    default:
      group = 'general-support';
  }

  const result = await task(ctx, {
    title: `Issue: ${input.issueType}`,
    form: { resolution: { type: 'textarea' } },
    assignTo: { group },
  });

  return result.data;
});
```

### Workload-Aware Assignment

Check current workload before assigning:

```typescript
import { workflow, task, parallel } from '@orkestra/sdk';

export const workloadAwareAssignment = workflow('workload-aware', async (ctx, input) => {
  // Get workload for multiple groups
  const [group1Load, group2Load] = await parallel([getGroupLoad('team-a'), getGroupLoad('team-b')]);

  // Assign to least busy group
  const targetGroup = group1Load < group2Load ? 'team-a' : 'team-b';

  const result = await task(ctx, {
    title: 'Process Request',
    form: {
      /* ... */
    },
    assignTo: { group: targetGroup },
  });

  return result.data;
});
```

### Regional Assignment

Assign based on geography or timezone:

```typescript
export const regionalRouting = workflow('regional-routing', async (ctx, input) => {
  const { customerRegion } = input;

  const regionGroups: Record<string, string> = {
    na: 'support-na',
    eu: 'support-eu',
    apac: 'support-apac',
  };

  const targetGroup = regionGroups[customerRegion] || 'support-global';

  const result = await task(ctx, {
    title: 'Regional Support Request',
    form: {
      /* ... */
    },
    assignTo: { group: targetGroup },
  });

  return result.data;
});
```

---

## Best Practices

### 1. Define Clear Groups

```typescript
// Good: Specific purpose groups
{
  'support-l1': { description: 'Level 1 Support' },
  'support-l2': { description: 'Level 2 Escalation' },
  'billing': { description: 'Billing Inquiries' },
}

// Bad: Generic groups
{
  'team-1': { description: 'Team 1' },
  'team-2': { description: 'Team 2' },
}
```

### 2. Choose Appropriate Strategy

```typescript
// Good: Match strategy to team needs
{
  'support': { strategy: 'round_robin' },      // Fair distribution
  'reviewers': { strategy: 'load_balanced' }, // Adapt to complexity
  'experts': { strategy: 'manual' },           // Self-selection
}

// Bad: One strategy for all
{
  'support': { strategy: 'manual' },
  'reviewers': { strategy: 'manual' },
  'experts': { strategy: 'manual' },
}
```

### 3. Handle Empty Groups

```typescript
// Always check if group has members before assigning
const groupMembers = await getGroupMembers(groupId);

if (groupMembers.length === 0) {
  // Escalate or notify
  await notifyAdmin('Group is empty', { groupId });
  return;
}

await task(ctx, {
  title: 'Task',
  form: {
    /* ... */
  },
  assignTo: { group: groupId },
});
```

### 4. Use Escalation for SLAs

```typescript
import { taskWithEscalation, escalationChain } from '@orkestra/sdk';

await taskWithEscalation(ctx, {
  title: 'Urgent Task',
  form: {
    /* ... */
  },
  assignTo: { group: 'primary-team' },
  escalation: escalationChain()
    .escalateAfter('15m', { group: 'backup-team' })
    .escalateAfter('30m', { group: 'managers' })
    .build(),
});
```

### 5. Log Assignment Decisions

```typescript
ctx.log.info('Assigning task', {
  taskId,
  assignTo,
  strategy: group.assignmentStrategy,
  memberCount: groupMembers.length,
});
```

### 6. Provide Context to Assignees

```typescript
await task(ctx, {
  title: 'Review Request',
  form: {
    /* ... */
  },
  assignTo: { group: 'reviewers' },
  context: {
    priority: 'high',
    requester: 'John Doe',
    department: 'Engineering',
    relatedTicket: 'TCK-12345',
  },
});
```

### 7. Monitor Assignment Balance

```typescript
// Check assignment distribution
const stats = await getAssignmentStats(group);

ctx.log.info('Group assignment stats', {
  groupId: group.id,
  totalTasks: stats.total,
  averagePerMember: stats.average,
  maxTasks: stats.max,
  minTasks: stats.min,
});
```

---

## Troubleshooting

### Tasks Not Being Assigned

**Symptoms**: Tasks created but not assigned to anyone

**Solutions**:

1. Check if group has active members
2. Verify group is marked as assignable
3. Check member status (must be 'active')
4. Review strategy configuration

```bash
# Check group status
npx orkestra group show support-l1

# List members
npx orkestra group member list support-l1
```

### Uneven Distribution

**Symptoms**: Some users get more tasks than others

**Solutions**:

1. Verify strategy is correctly configured
2. Check for old tasks stuck in progress
3. Ensure members have similar availability
4. Consider switching to load_balanced strategy

```typescript
// Check strategy
const group = await prisma.group.findUnique({
  where: { slug: 'support-l1' },
  select: { assignmentStrategy: true },
});

console.log('Strategy:', group.assignmentStrategy);
```

### Tasks Going to Wrong Person

**Symptoms**: Tasks assigned to unexpected users

**Solutions**:

1. Verify group membership is correct
2. Check for direct user assignments overriding group
3. Review workflow assignment logic
4. Check escalation rules

```typescript
// Debug: Log assignment target
ctx.log.info('Creating task', {
  title,
  assignTo,
  isDirect: !!assignTo.userId,
  isGroup: !!assignTo.group,
});
```

### Manual Group Tasks Not Claimable

**Symptoms**: Users can't claim tasks from group

**Solutions**:

1. Verify user is a group member
2. Check if group uses manual strategy
3. Ensure task is in 'assigned' state
4. Verify permissions

```bash
# Check user membership
npx orkestra user show usr_abc123

# Check group strategy
npx orkestra group show support-l1
```

### Round Robin Not Rotating

**Symptoms**: Same user getting all tasks

**Solutions**:

1. Check if round-robin state is tracked properly
2. Verify group has multiple members
3. Restart worker to reset state
4. Consider using database for state persistence

```typescript
// Reset round-robin state
import { RoundRobinStrategy } from '@orkestra/core';

const strategy = new RoundRobinStrategy();
strategy.reset('support-l1');
```

### Load Balancing Not Working

**Symptoms**: Not balancing workload effectively

**Solutions**:

1. Check active task count calculation
2. Verify task states included in count
3. Ensure tasks are marked completed promptly
4. Review what's considered "active"

```typescript
// Check user workload
const workload = await prisma.task.groupBy({
  by: ['assignedUserId'],
  where: {
    status: { in: ['assigned', 'in_progress'] },
    groupId: 'support-l1',
  },
  _count: true,
});
```

---

## Resources

- [Writing Workflows](./writing-workflows.md)
- [Task Concepts](../concepts/tasks.md)
- [Multi-Tenancy](../concepts/multi-tenancy.md)
- [SDK API Reference](../api-reference/sdk-reference.md)
