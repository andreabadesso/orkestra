# Quick Start

Get Orkestra running in under 5 minutes.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- pnpm (or npm/yarn)

## Step 1: Create Project

```bash
npx @orkestra/cli init my-support-bot
cd my-support-bot
```

This creates a project with:
- Pre-configured `package.json` with all dependencies
- `docker-compose.yml` for PostgreSQL and Temporal
- Example workflow and activities
- TypeScript configuration

## Step 2: Start Infrastructure

```bash
# Start PostgreSQL and Temporal
docker-compose up -d

# Wait for services to be ready (about 30 seconds)
sleep 30

# Verify Temporal is running
curl http://localhost:7233/api/v1/namespaces/default
```

## Step 3: Install and Build

```bash
# Install dependencies
pnpm install

# Push database schema
pnpm db:push
```

## Step 4: Start the Worker

```bash
# In one terminal, start the Temporal worker
pnpm dev
```

You should see:
```
Worker started successfully
```

## Step 5: Trigger a Workflow

Open another terminal and use the CLI to start a workflow:

```bash
# Start a workflow via the API (example with curl)
curl -X POST http://localhost:3000/api/workflows/start \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: default" \
  -H "X-API-Key: dev-key" \
  -d '{
    "type": "example",
    "input": {
      "message": "Hello from Quick Start!"
    }
  }'
```

## Step 6: View in Temporal UI

Open http://localhost:8080 in your browser to see:
- Running workflows
- Task queues
- Workflow history

## What You Built

Your project now has:

```
my-support-bot/
  src/
    workflows/
      example.ts      # Example workflow
    activities/
      example.ts      # Example activities
    worker.ts         # Temporal worker
  docker-compose.yml  # Infrastructure
  package.json        # Dependencies
```

## Example Workflow Code

The generated workflow (`src/workflows/example.ts`):

```typescript
import { workflow, task, timeout } from '@orkestra/sdk';

interface ExampleInput {
  message: string;
}

interface ExampleOutput {
  response: string;
  processedBy: string;
}

export const exampleWorkflow = workflow<ExampleInput, ExampleOutput>(
  'example',
  async (ctx, input) => {
    ctx.log.info('Workflow started', { message: input.message });

    // Create a human task
    const result = await task(ctx, {
      title: 'Process Message',
      description: `Review and respond to: ${input.message}`,
      form: {
        response: {
          type: 'textarea',
          label: 'Your Response',
          required: true,
        },
        priority: {
          type: 'select',
          label: 'Priority',
          options: [
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ],
        },
      },
      assignTo: { group: 'support-team' },
      sla: timeout('30m'),
    });

    return {
      response: result.data.response as string,
      processedBy: result.completedBy,
    };
  }
);
```

## Next Steps

1. **Create a real workflow**: [First Workflow Tutorial](./first-workflow.md)
2. **Understand the concepts**: [Architecture Overview](../concepts/architecture.md)
3. **Add AI integration**: [MCP Tools Reference](../api-reference/mcp-tools.md)
4. **Deploy to production**: [Deployment Guide](../guides/deployment.md)

## Quick Reference

Common commands:

```bash
# Development
pnpm dev              # Start worker with hot reload
pnpm build            # Build for production

# Database
pnpm db:push          # Push schema changes
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Prisma Studio

# Code generation
pnpm generate workflow my-workflow    # New workflow
pnpm generate activity my-activity    # New activity

# Infrastructure
docker-compose up -d   # Start services
docker-compose down    # Stop services
docker-compose logs -f # View logs
```

Useful URLs:

| Service | URL |
|---------|-----|
| Temporal UI | http://localhost:8080 |
| API | http://localhost:3000 |
| Prisma Studio | http://localhost:5555 |
