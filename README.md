# Orkestra

AI-native workflow orchestration with human-in-the-loop capabilities.

## What It Does

Orkestra bridges AI agents and human decision-making through Temporal workflows. When an AI agent hits its limits (low confidence, needs approval, complex decisions), it creates a structured task for a human. The human completes the task, and the workflow resumes automatically.

## Core Features

- **Workflows**: Durable, code-first business processes using Temporal
- **Human Tasks**: Structured forms with SLAs and escalation chains
- **MCP Server**: Native AI agent integration via Model Context Protocol
- **Multi-tenancy**: Built-in tenant isolation enforced at the type level
- **API**: REST and tRPC endpoints for traditional integrations
- **Notifications**: Configurable routing to Slack, email, dashboard

## Tech Stack

| Component       | Technology            |
| --------------- | --------------------- |
| Language        | TypeScript            |
| Workflow Engine | Temporal              |
| Database        | PostgreSQL + Prisma   |
| AI Interface    | MCP (Anthropic SDK)   |
| API             | tRPC                  |
| Dashboard       | Next.js (in progress) |

## Quick Start

```bash
# Clone and install
git clone https://github.com/yourorg/orkestra.git
cd orkestra
nix develop  # or install Node.js 20+, Docker, pnpm
pnpm install

# Start infrastructure
docker compose up -d

# Build packages
pnpm build

# Run tests
pnpm test
```

## Example Workflow

```typescript
import { workflow, task, timeout } from '@orkestra/sdk';

export const customerSupport = workflow('customer-support', async (ctx, input) => {
  const { question, conversationId, customerId } = input;

  // AI couldn't answer confidently - ask human
  const result = await task(ctx, {
    title: 'Customer needs help',
    form: {
      answer: { type: 'textarea', required: true },
      sentiment: {
        type: 'select',
        options: [
          { value: 'positive', label: 'Positive' },
          { value: 'neutral', label: 'Neutral' },
          { value: 'frustrated', label: 'Frustrated' },
        ],
      },
    },
    assignTo: { group: 'support-l1' },
    context: { conversationId, customerId },
    sla: timeout('30m'),
  });

  return { answer: result.data.answer, handledBy: 'human' };
});
```

## Project Status

### Complete (15/18 tasks)

- Core engine (Temporal integration, Task Manager)
- SDK (workflow, task, escalation helpers)
- MCP Server (17 tools for AI agents)
- REST API (tRPC endpoints)
- CLI (init, dev, generate, db)
- Testing (53 unit tests + 45 integration tests)
- Example project (support bot with AI-first escalation)

### In Progress (3/18 tasks)

- Dashboard UI (web interface for task completion)
- Documentation (getting started guides, API reference)
- Release preparation (npm publishing, CI/CD)

**Note**: The system is fully functional via API and MCP. Dashboard UI is optional.

## Package Structure

```
orkestra/
├── packages/
│   ├── core/         # Main orchestration engine
│   ├── sdk/          # Developer-friendly workflow helpers
│   ├── mcp-server/   # MCP interface for AI agents
│   ├── api/          # REST/tRPC API
│   ├── dashboard/    # Human task management UI
│   └── cli/          # CLI for scaffolding
├── examples/
│   └── support-bot/  # Complete example application
└── docs/             # Documentation
```

## Use Cases

- Customer support bots with human escalation
- Document approval workflows
- Content moderation pipelines
- Sales lead qualification
- Compliance review processes

## Documentation

- [Architecture](docs/Architecture.md) - System design
- [Workflows](docs/concepts/workflows.md) - Workflow patterns
- [Task Index](docs/tasks/00%20-%20Task%20Index.md) - Implementation roadmap

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
pnpm test:integration

# Run example
cd examples/support-bot
pnpm dev      # Start worker
pnpm worker   # Start Temporal worker
```

## License

MIT
