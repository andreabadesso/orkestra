# Task 04: Temporal Integration

## Overview

Implement the Temporal client and worker setup in `@orkestra/core`, establishing the foundation for workflow execution.

## Phase

🟢 **Phase 2: Core Engine**

## Priority

🔴 **Critical** - Core workflow functionality

## Estimated Effort

6-8 hours

## Description

Integrate Temporal SDK into Orkestra, creating client factories, worker configuration, and the basic infrastructure for running workflows.

## Requirements

### Package Structure Addition

```
packages/core/src/
├── temporal/
│   ├── index.ts
│   ├── client.ts           # Temporal client factory
│   ├── worker.ts           # Worker configuration
│   ├── connection.ts       # Connection management
│   └── interceptors/
│       ├── index.ts
│       ├── tenant.ts       # Tenant context interceptor
│       └── tracing.ts      # Langfuse tracing interceptor
```

### Temporal Client Factory

```typescript
// temporal/client.ts
import { Client, Connection } from '@temporalio/client';
import { OrkestraConfig } from '../config';

export interface TemporalClientOptions {
  config: OrkestraConfig;
  namespace?: string;
}

export async function createTemporalClient(
  options: TemporalClientOptions
): Promise<Client> {
  const { config, namespace } = options;

  const connection = await Connection.connect({
    address: config.temporal.address,
  });

  return new Client({
    connection,
    namespace: namespace ?? config.temporal.namespace,
  });
}

// Workflow handle utilities
export async function startWorkflow<T>(
  client: Client,
  workflowType: string,
  options: {
    taskQueue: string;
    workflowId?: string;
    args: unknown[];
    memo?: Record<string, unknown>;
    searchAttributes?: Record<string, unknown>;
  }
): Promise<WorkflowHandle<T>> {
  return client.workflow.start(workflowType, {
    taskQueue: options.taskQueue,
    workflowId: options.workflowId,
    args: options.args,
    memo: options.memo,
    searchAttributes: options.searchAttributes,
  });
}
```

### Worker Configuration

```typescript
// temporal/worker.ts
import { Worker, NativeConnection } from '@temporalio/worker';
import { OrkestraConfig } from '../config';

export interface WorkerOptions {
  config: OrkestraConfig;
  taskQueue: string;
  workflowsPath: string;
  activities: Record<string, unknown>;
  interceptors?: WorkerInterceptors;
}

export async function createWorker(options: WorkerOptions): Promise<Worker> {
  const { config, taskQueue, workflowsPath, activities, interceptors } = options;

  const connection = await NativeConnection.connect({
    address: config.temporal.address,
  });

  return Worker.create({
    connection,
    namespace: config.temporal.namespace,
    taskQueue,
    workflowsPath,
    activities,
    interceptors,
  });
}

export async function runWorker(worker: Worker): Promise<void> {
  await worker.run();
}
```

### Tenant Context Interceptor

```typescript
// temporal/interceptors/tenant.ts
import {
  WorkflowInterceptors,
  WorkflowInboundCallsInterceptor,
  WorkflowExecuteInput,
  Next,
} from '@temporalio/workflow';

export class TenantInterceptor implements WorkflowInboundCallsInterceptor {
  async execute(
    input: WorkflowExecuteInput,
    next: Next<WorkflowInboundCallsInterceptor, 'execute'>
  ): Promise<unknown> {
    // Extract tenant from headers/memo
    const tenantId = input.headers.get('tenantId');

    if (!tenantId) {
      throw new Error('Tenant ID required for workflow execution');
    }

    // Set tenant context for workflow
    // (Implementation depends on how we pass context)

    return next(input);
  }
}

export const tenantInterceptors: WorkflowInterceptors = {
  inbound: [new TenantInterceptor()],
};
```

### Tracing Interceptor (Langfuse)

```typescript
// temporal/interceptors/tracing.ts
import {
  ActivityInboundCallsInterceptor,
  ActivityExecuteInput,
  Next,
} from '@temporalio/worker';

export class TracingInterceptor implements ActivityInboundCallsInterceptor {
  constructor(private langfuse?: LangfuseClient) {}

  async execute(
    input: ActivityExecuteInput,
    next: Next<ActivityInboundCallsInterceptor, 'execute'>
  ): Promise<unknown> {
    if (!this.langfuse) {
      return next(input);
    }

    const span = this.langfuse.span({
      name: `activity:${input.activityType}`,
      input: input.args,
    });

    try {
      const result = await next(input);
      span.end({ output: result });
      return result;
    } catch (error) {
      span.end({ level: 'ERROR', statusMessage: String(error) });
      throw error;
    }
  }
}
```

### Connection Pool Management

```typescript
// temporal/connection.ts
export class TemporalConnectionManager {
  private client: Client | null = null;
  private connection: Connection | null = null;

  constructor(private config: OrkestraConfig) {}

  async getClient(): Promise<Client> {
    if (!this.client) {
      this.connection = await Connection.connect({
        address: this.config.temporal.address,
      });
      this.client = new Client({
        connection: this.connection,
        namespace: this.config.temporal.namespace,
      });
    }
    return this.client;
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      this.client = null;
    }
  }
}
```

## Acceptance Criteria

- [ ] Temporal client factory creates valid clients
- [ ] Worker can be created and configured
- [ ] Connection pooling works correctly
- [ ] Tenant interceptor enforces tenant context
- [ ] Tracing interceptor integrates with Langfuse (when enabled)
- [ ] Clean shutdown of connections
- [ ] Unit tests for client creation
- [ ] Integration test with local Temporal
- [ ] Error handling for connection failures
- [ ] Retry logic for transient failures

## Dependencies

- [[01 - Initialize Monorepo]]
- [[02 - Docker Dev Environment]]
- [[03 - Core Package Setup]]

## Blocked By

- [[03 - Core Package Setup]] - Need types and config

## Blocks

- [[07 - SDK Workflow Helpers]]
- [[14 - Integration Testing]]

## Technical Notes

### Temporal SDK Packages

```json
{
  "dependencies": {
    "@temporalio/client": "^1.9.0",
    "@temporalio/worker": "^1.9.0",
    "@temporalio/workflow": "^1.9.0",
    "@temporalio/activity": "^1.9.0"
  }
}
```

### Workflow Bundle

Temporal requires workflow code to be bundled separately. Consider using the Temporal bundler:

```typescript
import { bundleWorkflowCode } from '@temporalio/worker';

const workflowBundle = await bundleWorkflowCode({
  workflowsPath: require.resolve('./workflows'),
});
```

### Search Attributes

For querying workflows by tenant:

```typescript
// Register custom search attribute in Temporal
// tctl search-attribute create -name tenantId -type Keyword

// Use in workflow
searchAttributes: {
  tenantId: [tenantId],
}
```

### Health Checks

Implement health check for Temporal connection:

```typescript
async function checkTemporalHealth(client: Client): Promise<boolean> {
  try {
    await client.workflowService.getSystemInfo({});
    return true;
  } catch {
    return false;
  }
}
```

## References

- [Temporal TypeScript SDK](https://docs.temporal.io/dev-guide/typescript)
- [Temporal Interceptors](https://docs.temporal.io/dev-guide/typescript/observability#interceptors)
- [Temporal Worker](https://docs.temporal.io/workers)

## Tags

#orkestra #task #core #temporal #workflows
