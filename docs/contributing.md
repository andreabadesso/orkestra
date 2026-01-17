# Contributing to Orkestra

Thank you for your interest in contributing to Orkestra! This guide will help you get started.

## Development Setup

### Prerequisites

- **Node.js** 20 or higher
- **pnpm** (recommended) or npm/yarn
- **Docker** and **Docker Compose**
- **Nix** (optional but recommended for reproducible environments)

### Getting Started

1. **Clone the repository**

```bash
git clone https://github.com/your-org/orkestra.git
cd orkestra
```

2. **Install dependencies**

```bash
# Using nix (recommended)
nix develop
pnpm install

# Or without nix
pnpm install
```

3. **Start infrastructure**

```bash
docker compose up -d
```

This starts:

- PostgreSQL on `localhost:5432`
- Temporal on `localhost:7233`
- Temporal UI on `localhost:8080`

4. **Build the project**

```bash
pnpm build
```

5. **Run tests**

```bash
pnpm test              # Unit tests
pnpm test:integration  # Integration tests
```

## Code Style Guidelines

### TypeScript

- Use strict TypeScript settings (already configured in tsconfig.json)
- Prefer explicit types over implicit types
- Use interfaces for public APIs, types for internal use
- Avoid `any`; use `unknown` when necessary

### Naming Conventions

- **Files**: kebab-case (e.g., `task-manager.ts`, `form-schema.ts`)
- **Classes**: PascalCase (e.g., `TaskManager`, `FormValidator`)
- **Functions/Variables**: camelCase (e.g., `createTask`, `taskManager`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `AI_CONFIDENCE_THRESHOLD`)
- **Types/Interfaces**: PascalCase (e.g., `TaskInput`, `WorkflowContext`)

### Imports

Order imports consistently:

```typescript
// 1. External dependencies
import { z } from 'zod';
import * as temporal from '@temporalio/workflow';

// 2. Internal workspace packages
import { workflow } from '@orkestra/sdk';
import { type Task } from '@orkestra/core';

// 3. Internal modules (relative imports)
import { generateId } from './utils/id.js';
import { logger } from './logger.js';
```

### Code Organization

Follow this structure for TypeScript files:

```typescript
// 1. Imports
import { ... } from '...';

// 2. Constants
const MAX_RETRY_ATTEMPTS = 3;

// 3. Types/Interfaces
interface TaskInput { ... }

type TaskOutput = { ... };

// 4. Implementation
export function createTask(input: TaskInput): TaskOutput {
  // ...
}

// 5. Helper functions (if any)
function helper() { ... }
```

### Comments

- **Avoid inline comments**: Let the code speak for itself
- **Document public APIs**: Use JSDoc for exported functions and interfaces
- **Explain complex logic**: Only comment non-obvious algorithms

```typescript
/**
 * Creates a new human task and waits for completion.
 *
 * @param ctx - Workflow context
 * @param input - Task configuration
 * @returns Completed task data
 */
export async function task(ctx: WorkflowContext, input: TaskInput): Promise<TaskResult> {
  // ...
}
```

### Error Handling

- Use custom error types (already defined in `packages/core/src/errors.ts`)
- Always include context in error messages
- Never throw generic `Error` or string errors

```typescript
import { TaskNotFoundError } from '@orkestra/core';

export async function completeTask(taskId: string, data: unknown) {
  const task = await findTask(taskId);

  if (!task) {
    throw new TaskNotFoundError(taskId);
  }

  // ...
}
```

## Testing Requirements

### Unit Tests

- All public functions must have unit tests
- Aim for 80%+ code coverage
- Use Vitest (already configured)
- Mock external dependencies

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createTask } from './task-manager';

describe('createTask', () => {
  it('should create a task with valid input', async () => {
    const mockDb = vi.mocked(db);
    mockDb.task.create.mockResolvedValue({ id: 'task_123' });

    const result = await createTask({
      title: 'Test Task',
      form: { field: { type: 'text' } },
      assignTo: { group: 'default' },
    });

    expect(result.id).toBe('task_123');
  });

  it('should throw error for invalid form schema', async () => {
    await expect(
      createTask({
        title: 'Test',
        form: { invalid: 'schema' },
        assignTo: { group: 'default' },
      })
    ).rejects.toThrow(InvalidFormSchemaError);
  });
});
```

### Integration Tests

- Test workflows end-to-end
- Use test containers for Temporal and PostgreSQL
- Clean up test data after each test

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestEnvironment } from '@tests/setup';

describe('Task Workflow Integration', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await TestEnvironment.create();
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should complete a task workflow', async () => {
    const workflowId = await env.client.workflow.start('test-workflow', {
      args: [{ message: 'test' }],
    });

    // Complete the task
    await env.taskManager.completeTask('task_123', { response: 'done' });

    // Wait for workflow completion
    const result = await env.client.workflow.result(workflowId);
    expect(result.status).toBe('completed');
  });
});
```

### Test Database

Use a separate test database:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'postgresql://user:pass@localhost:5433/orkestra_test',
    },
    setupFiles: ['./tests/setup.ts'],
  },
});
```

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm test --filter @orkestra/core

# Watch mode
pnpm test --watch

# Coverage
pnpm test --coverage
```

## Pull Request Process

### Before Submitting

1. **Run linter and typecheck**

```bash
pnpm lint
pnpm typecheck
```

2. **Run all tests**

```bash
pnpm test
pnpm test:integration
```

3. **Build packages**

```bash
pnpm build
```

### PR Guidelines

1. **Use descriptive titles**

```
feat: Add task escalation chain API
fix: Resolve race condition in task completion
docs: Update API reference for workflows
```

2. **Link to related issues**

Include the issue number in the PR description or commit message:

```
Add task escalation chain API

Fixes #123
```

3. **Keep PRs focused**: One PR should address one issue or feature
4. **Update documentation**: If you change behavior, update the docs
5. **Add tests**: Ensure new code has tests
6. **Clean up**: Remove debug code, console.log statements, etc.

### PR Checklist

Before submitting, ensure:

- [ ] Code follows project style guidelines
- [ ] All tests pass (unit and integration)
- [ ] New code has tests (80%+ coverage)
- [ ] Documentation is updated (if needed)
- [ ] Commit messages are clear and follow conventional commits
- [ ] No merge conflicts with main branch

### Review Process

1. Automated checks (CI) must pass
2. At least one maintainer approval
3. Address all review comments
4. Squash commits if needed (maintainers may request this)

## Documentation Standards

### Getting Started Guides

- Assume reader has basic Node.js knowledge
- Provide complete code examples
- Explain why, not just how
- Include troubleshooting section

Example:

```markdown
# Creating Your First Workflow

Learn how to create a simple workflow with human tasks.

## Prerequisites

- Node.js 20+
- Docker and Docker Compose

## Step 1: Define the Workflow

Create a file `src/workflows/hello-world.ts`:

\`\`\`typescript
import { workflow, task } from '@orkestra/sdk';

export const helloWorld = workflow('hello-world', async (ctx, input) => {
const result = await task(ctx, {
title: 'Say Hello',
form: {
greeting: { type: 'text', label: 'Your greeting', required: true },
},
assignTo: { group: 'default' },
});

return { greeting: result.data.greeting };
});
\`\`\`

## Step 2: Register the Workflow

...
```

### API Reference

Use this format for API docs:

```markdown
## task()

Creates a new human task and waits for completion.

### Parameters

| Name  | Type            | Required | Description        |
| ----- | --------------- | -------- | ------------------ |
| ctx   | WorkflowContext | Yes      | Workflow context   |
| input | TaskInput       | Yes      | Task configuration |

### Returns

`Promise<TaskResult>` - Completed task data

### Example

\`\`\`typescript
const result = await task(ctx, {
title: 'Review Request',
form: {
approved: { type: 'boolean', label: 'Approved?' },
},
assignTo: { group: 'managers' },
});
\`\`\`

### Throws

- `TaskCreationError` - If task creation fails
- `TaskTimeoutError` - If task exceeds SLA
```

### Code Examples

- All examples must be runnable
- Include import statements
- Use realistic values
- Add comments explaining key parts

```typescript
import { workflow, task, timeout } from '@orkestra/sdk';

export const customerSupport = workflow('customer-support', async (ctx, input) => {
  const { message, customerId } = input;

  // Try AI first
  const aiResponse = await tryAIResponse(message);

  // If low confidence, ask human
  if (aiResponse.confidence < 0.8) {
    const humanResult = await task(ctx, {
      title: 'Customer Support Needed',
      form: {
        response: {
          type: 'textarea',
          label: 'Your Response',
          required: true,
        },
      },
      assignTo: { group: 'support' },
      context: { customerId, message, aiSuggestion: aiResponse.text },
      sla: timeout('30m'),
    });

    return humanResult.data;
  }

  return aiResponse.text;
});
```

### Concept Documentation

Explain the "why" and "how" of core concepts:

```markdown
# Tasks

Tasks are the bridge between AI agents and human decision-makers.

## What is a Task?

A Task is a unit of work that requires human input. When an AI agent encounters
something it can't handle autonomously, it creates a Task and waits for a human
to complete it.

## Why Use Tasks?

- **AI Limitations**: AI can't handle complex decisions, sensitive data, or edge cases
- **Human Oversight**: Maintain control over critical business processes
- **Hybrid Intelligence**: Combine AI speed with human judgment
```

## Getting Help

- **Documentation**: Check the [docs/](../docs/) directory
- **Issues**: Search [existing issues](https://github.com/your-org/orkestra/issues)
- **Discussions**: Use GitHub Discussions for questions
- **Discord**: Join our community Discord (link in README)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
