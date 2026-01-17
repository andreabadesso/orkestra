# Task 03: Core Package Setup

## Overview

Build the `@orkestra/core` package with foundational types, configuration, and dependency injection setup.

## Phase

🔵 **Phase 1: Foundation**

## Priority

🔴 **Critical** - Foundation for all other packages

## Estimated Effort

4-6 hours

## Description

The core package contains shared types, interfaces, configuration management, and the dependency injection container that other packages will use.

## Requirements

### Package Structure

```
packages/core/
├── src/
│   ├── index.ts              # Public exports
│   ├── types/
│   │   ├── index.ts
│   │   ├── tenant.ts
│   │   ├── user.ts
│   │   ├── task.ts
│   │   ├── workflow.ts
│   │   ├── conversation.ts
│   │   └── common.ts
│   ├── config/
│   │   ├── index.ts
│   │   ├── schema.ts         # Zod schemas for config
│   │   └── loader.ts         # Config loading logic
│   ├── context/
│   │   ├── index.ts
│   │   ├── request-context.ts
│   │   └── tenant-context.ts
│   ├── errors/
│   │   ├── index.ts
│   │   └── base-error.ts
│   └── utils/
│       ├── index.ts
│       ├── id.ts             # ID generation
│       └── date.ts           # Date utilities
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

### Core Types

Define TypeScript interfaces for all domain entities (see Architecture.md):

```typescript
// types/tenant.ts
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  config: TenantConfig;
  limits?: TenantLimits;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantStatus = 'active' | 'suspended' | 'deleted';

export interface TenantConfig {
  notifications: NotificationConfig;
  slaDefaults: SLADefaults;
  workflowSettings: WorkflowSettings;
}

// Similar for User, Group, Task, Workflow, Conversation, Message
```

### Configuration Management

```typescript
// config/schema.ts
import { z } from 'zod';

export const orkestraConfigSchema = z.object({
  database: z.object({
    url: z.string().url(),
    maxConnections: z.number().default(10),
  }),
  temporal: z.object({
    address: z.string().default('localhost:7233'),
    namespace: z.string().default('default'),
    taskQueue: z.string().default('orkestra'),
  }),
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('0.0.0.0'),
  }),
  auth: z.object({
    jwtSecret: z.string().min(32),
    apiKeyHeader: z.string().default('x-api-key'),
  }),
  langfuse: z.object({
    enabled: z.boolean().default(false),
    publicKey: z.string().optional(),
    secretKey: z.string().optional(),
    baseUrl: z.string().url().optional(),
  }).optional(),
});

export type OrkestraConfig = z.infer<typeof orkestraConfigSchema>;
```

### Request Context

```typescript
// context/request-context.ts
export interface RequestContext {
  tenantId: string;
  userId: string;
  role: Role;
  groups: string[];
  permissions: Permission[];
  traceId?: string;
}

export type Role = 'admin' | 'member';

export type Permission =
  | 'tasks:read'
  | 'tasks:write'
  | 'tasks:admin'
  | 'workflows:read'
  | 'workflows:write'
  | 'conversations:read'
  | 'conversations:write'
  | 'admin:users'
  | 'admin:groups'
  | 'admin:settings';
```

### Error Handling

```typescript
// errors/base-error.ts
export class OrkestraError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'OrkestraError';
  }
}

export class NotFoundError extends OrkestraError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
  }
}

export class UnauthorizedError extends OrkestraError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends OrkestraError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ValidationError extends OrkestraError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}
```

### ID Generation

```typescript
// utils/id.ts
import { nanoid } from 'nanoid';

export const generateId = (prefix?: string): string => {
  const id = nanoid(21);
  return prefix ? `${prefix}_${id}` : id;
};

// Typed ID generators
export const generateTenantId = () => generateId('ten');
export const generateUserId = () => generateId('usr');
export const generateTaskId = () => generateId('tsk');
export const generateWorkflowId = () => generateId('wfl');
export const generateConversationId = () => generateId('cnv');
export const generateMessageId = () => generateId('msg');
```

## Acceptance Criteria

- [ ] All domain types defined and exported
- [ ] Zod config schema validates correctly
- [ ] Config loader reads from env and files
- [ ] Request context types defined
- [ ] Error classes defined with proper inheritance
- [ ] ID generation utilities work
- [ ] All types have JSDoc comments
- [ ] Unit tests for config validation
- [ ] Unit tests for ID generation
- [ ] Package builds without errors
- [ ] Types are properly exported from index.ts

## Dependencies

- [[01 - Initialize Monorepo]]

## Blocked By

- [[01 - Initialize Monorepo]]

## Blocks

- [[04 - Temporal Integration]]
- [[05 - Database Schema]]
- [[06 - Task Manager]]
- [[08 - MCP Server]]

## Technical Notes

### Dependencies for this Package

```json
{
  "dependencies": {
    "zod": "^3.22.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

### Export Strategy

Use explicit exports in `index.ts`:

```typescript
// Types
export * from './types';

// Config
export { orkestraConfigSchema, type OrkestraConfig } from './config';
export { loadConfig } from './config/loader';

// Context
export type { RequestContext, Role, Permission } from './context';

// Errors
export * from './errors';

// Utils
export * from './utils';
```

## References

- [[Architecture]] - Full type definitions
- [Zod Documentation](https://zod.dev/)
- [nanoid](https://github.com/ai/nanoid)

## Tags

#orkestra #task #foundation #core #types #typescript
