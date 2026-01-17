# Orkestra Documentation

**Orkestra** is an opinionated, AI-native BPM orchestration backend with human-in-the-loop capabilities. It bridges AI agents and human decision-making through configurable Temporal workflows.

## Quick Links

| Getting Started | Concepts | Guides | API Reference |
|-----------------|----------|--------|---------------|
| [Installation](./getting-started/installation.md) | [Architecture](./concepts/architecture.md) | [Writing Workflows](./guides/writing-workflows.md) | [MCP Tools](./api-reference/mcp-tools.md) |
| [Quick Start](./getting-started/quick-start.md) | [Workflows](./concepts/workflows.md) | [Form Schemas](./guides/form-schemas.md) | [REST API](./api-reference/rest-api.md) |
| [First Workflow](./getting-started/first-workflow.md) | [Tasks](./concepts/tasks.md) | [Deployment](./guides/deployment.md) | [SDK Reference](./api-reference/sdk-reference.md) |
| | [Multi-tenancy](./concepts/multi-tenancy.md) | | [CLI Reference](./api-reference/cli-reference.md) |

## What is Orkestra?

Every AI-powered application eventually needs human oversight. When an AI agent hits its limits (low confidence, needs approval, complex decision), it needs a structured way to:

1. **Escalate to humans** without losing context
2. **Wait for human input** with SLAs and escalation chains
3. **Resume execution** seamlessly after human response

Orkestra provides this infrastructure out of the box:

- **MCP Server** - AI agents interact natively via Model Context Protocol
- **Temporal Workflows** - Durable, code-first business processes
- **Human Tasks** - Structured forms with SLAs and escalation
- **Multi-tenancy** - Built-in from day one
- **Dashboard** - Clean UI for humans to handle tasks

## Example Use Case

A support bot built on Orkestra:

```
User asks question
        |
        v
+-------------------+
|   AI Agent        |
|   (tries to       |
|    answer)        |
+-------------------+
        |
        | confidence < threshold
        v
+-------------------+
|   Orkestra        |
|   workflow_start  |
+-------------------+
        |
        v
+-------------------+
|   Task Created    |
|   (form: answer)  |
+-------------------+
        |
        v
+-------------------+
|   Human Agent     |
|   (dashboard)     |
|   fills form      |
+-------------------+
        |
        v
+-------------------+
|   Workflow        |
|   Resumes         |
+-------------------+
        |
        v
+-------------------+
|   AI Agent sends  |
|   response        |
+-------------------+
```

## Code Example

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
        ]
      },
    },
    assignTo: { group: 'support-l1' },
    context: { conversationId, customerId },
    sla: timeout('30m'),
  });

  return { answer: result.data.answer, handledBy: 'human' };
});
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript |
| Workflow Engine | Temporal |
| MCP Server | Anthropic MCP SDK |
| API | REST + tRPC |
| Dashboard | Next.js + Tailwind + shadcn/ui |
| Database | PostgreSQL |
| Observability | Langfuse adapter |

## Package Structure

```
@orkestra/
  core/         # Main orchestration engine
  sdk/          # Developer-friendly workflow helpers
  mcp-server/   # MCP interface for AI agents
  api/          # REST/tRPC API
  dashboard/    # Human task management UI
  cli/          # CLI for scaffolding
```

## Next Steps

1. **New to Orkestra?** Start with the [Quick Start Guide](./getting-started/quick-start.md)
2. **Want to understand the concepts?** Read [Architecture](./concepts/architecture.md)
3. **Ready to build?** Follow [Writing Workflows](./guides/writing-workflows.md)
4. **Integrating with AI?** Check the [MCP Tools Reference](./api-reference/mcp-tools.md)

## License

MIT (planned)
