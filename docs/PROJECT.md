# Orkestra

**An opinionated, AI-native BPM orchestration backend with human-in-the-loop.**

Orkestra is an open-source framework that bridges AI agents and human decision-making through configurable Temporal workflows. It's designed to be the backbone for any application where AI needs to escalate to humans gracefully.

## The Problem

AI agents are powerful but not omniscient. When they hit their limits, they need a structured way to:

1. Escalate to humans without losing context
2. Wait for human input (with SLAs and escalation chains)
3. Resume execution seamlessly after human response

Current solutions either:
- Force you to build this from scratch every time
- Are too low-level (raw Temporal) or too high-level (rigid no-code BPM tools)
- Aren't designed with AI agents as first-class citizens

## The Solution

Orkestra provides:

- **MCP Server** - AI agents interact natively via Model Context Protocol
- **Temporal Integration** - Durable, code-first workflows with battle-tested reliability
- **Human-in-the-Loop** - Structured tasks with forms, SLAs, and escalation
- **Multi-tenancy** - Built-in from day one, enforced at the type level
- **Dashboard** - Minimal UI for humans to handle tasks
- **Optional Connectors** - WhatsApp, Slack, Email (separate packages)

## Example Use Case

A WhatsApp support bot built on Orkestra:

```
User asks question
        │
        ▼
┌───────────────────┐
│   AI Agent        │
│   (tries to       │
│    answer)        │
└───────────────────┘
        │
        │ confidence < threshold
        ▼
┌───────────────────┐
│   Orkestra        │
│   workflow_start  │──────────────────────────┐
└───────────────────┘                          │
        │                                      │
        ▼                                      ▼
┌───────────────────┐                 ┌───────────────────┐
│   Task Created    │                 │   Temporal        │
│   (form: answer,  │                 │   (durable wait)  │
│    followUp?)     │                 └───────────────────┘
└───────────────────┘                          │
        │                                      │
        ▼                                      │
┌───────────────────┐                          │
│   Human Agent     │                          │
│   (dashboard)     │                          │
│   fills form      │                          │
└───────────────────┘                          │
        │                                      │
        │ task_complete                        │
        ▼                                      │
┌───────────────────┐                          │
│   Workflow        │◄─────────────────────────┘
│   Resumes         │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│   AI Agent        │
│   sends response  │
│   to user         │
└───────────────────┘
```

## Core Principles

1. **Code-First Workflows** - No visual BPMN editors. Workflows are TypeScript code, version-controlled, testable.

2. **MCP as Primary AI Interface** - AI agents don't hit REST endpoints; they use MCP tools natively.

3. **Opinionated Defaults** - Strong conventions for common patterns (escalation, SLAs, task assignment).

4. **Composable Architecture** - Core is lean; connectors and extensions are separate packages.

5. **Multi-Tenant by Default** - Every entity is tenant-scoped. No accidental data leaks.

## Tech Stack

| Component       | Technology                     |
| --------------- | ------------------------------ |
| Language        | TypeScript                     |
| Workflow Engine | Temporal                       |
| MCP Server      | Anthropic MCP SDK              |
| API             | REST + tRPC                    |
| Dashboard       | Next.js + Tailwind + shadcn/ui |
| Database        | PostgreSQL                     |
| Queue           | Temporal (built-in)            |
| Observability   | Langfuse adapter               |

## Package Structure

```
orkestra/
├── packages/
│   ├── core/                 # Main orchestration engine
│   ├── mcp-server/           # MCP interface for AI agents
│   ├── api/                  # REST/tRPC API
│   ├── dashboard/            # Human task management UI
│   ├── sdk/                  # SDK for writing workflows
│   ├── cli/                  # CLI for scaffolding
│   └── connectors/
│       ├── whatsapp/
│       ├── slack/
│       ├── email/
│       └── telegram/
├── examples/
│   ├── support-bot/
│   └── sales-assistant/
└── docs/
```

## Quick Start (Future)

```bash
# Create new project
npx create-orkestra my-bot

# Start dev environment
cd my-bot
npx orkestra dev

# Generate a workflow
npx orkestra generate workflow customer-escalation
```

## Documentation

- [[Architecture]] - Detailed system design
- [[Tasks/00 - Task Index|Task Breakdown]] - Implementation tasks for agents

## Status

🟡 **Planning** - Architecture finalized, ready for implementation.

## License

MIT (planned)

## Tags

#orkestra #bpm #temporal #mcp #ai-native #human-in-the-loop
