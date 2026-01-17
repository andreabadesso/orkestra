# Quick Start

Get Orkestra running in under 5 minutes.

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- pnpm (recommended) or npm

## Create a New Project

```bash
npx create-orkestra my-app
cd my-app
```

## Start Development Environment

```bash
npx orkestra dev
```

This starts:

- PostgreSQL on `localhost:5432`
- Temporal on `localhost:7233`
- Temporal UI on `localhost:8080`
- Orkestra API on `localhost:3000`
- Dashboard on `localhost:3001`

## Create Your First Workflow

```bash
npx orkestra generate workflow hello-world --with-task
```

This creates `src/workflows/hello-world.ts`:

```typescript
import { workflow, task, timeout } from '@orkestra/sdk';

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
```

## Start the Workflow

Using the MCP server (for AI agents):

```typescript
// In your AI agent
const result = await mcp.callTool({
  name: 'workflow_start',
  arguments: {
    name: 'hello-world',
    input: {},
  },
});
```

Or using the REST API:

```bash
curl -X POST http://localhost:3000/trpc/workflow.start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "hello-world", "input": {}}'
```

## Complete the Task

1. Open the Dashboard at `http://localhost:3001`
2. Log in with the default credentials
3. Find your task in the inbox
4. Fill in the form and submit

The workflow will automatically resume and complete!

## Next Steps

- [Writing Workflows](./first-workflow.md)
- [Form Schemas](../guides/form-schemas.md)
- [Deployment Guide](../guides/deployment.md)
