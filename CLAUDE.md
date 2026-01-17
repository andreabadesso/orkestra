# Orkestra

## What Is This Project?

Orkestra is an **opinionated, AI-native BPM orchestration backend** with human-in-the-loop capabilities. It bridges AI agents and human decision-making through configurable Temporal workflows.

**Core idea**: When an AI agent hits its limits (low confidence, needs approval, complex decision), it creates a structured task for a human. The human completes the task via a dashboard, and the workflow automatically resumes.

## Why Build This?

Every AI-powered application eventually needs human oversight. Currently, developers rebuild this pattern from scratch every time. Orkestra provides:

- **MCP Server** - AI agents interact natively via Model Context Protocol
- **Temporal Workflows** - Durable, code-first business processes
- **Human Tasks** - Structured forms with SLAs and escalation
- **Multi-tenancy** - Built-in from day one
- **Dashboard** - Clean UI for humans to handle tasks

## Tech Stack

| Component       | Technology                     |
| --------------- | ------------------------------ |
| Language        | TypeScript                     |
| Workflow Engine | Temporal                       |
| MCP Server      | Anthropic MCP SDK              |
| API             | REST + tRPC                    |
| Dashboard       | Next.js + Tailwind + shadcn/ui |
| Database        | PostgreSQL                     |
| Observability   | Langfuse adapter               |

## Project Structure (Target)

```
orkestra/
├── packages/
│   ├── core/                 # Main orchestration engine
│   ├── sdk/                  # Developer-friendly workflow helpers
│   ├── mcp-server/           # MCP interface for AI agents
│   ├── api/                  # REST/tRPC API
│   ├── dashboard/            # Human task management UI
│   └── cli/                  # CLI for scaffolding
├── examples/
│   └── support-bot/          # Full example application
├── docs/                     # Documentation & task specs
└── docker-compose.yml
```

---

## Task Documentation

All implementation tasks are in `docs/tasks/`. Each task is self-contained with:

- Overview and requirements
- Code examples and schemas
- Acceptance criteria (checkboxes)
- Dependencies on other tasks

**Start with**: `docs/tasks/00 - Task Index.md` for the full roadmap.

---

## Current Progress

### Phase 1: Foundation 🔵

- [x] Task 01 - Initialize Monorepo
- [x] Task 02 - Docker Dev Environment
- [x] Task 03 - Core Package Setup

### Phase 2: Core Engine 🟢

- [x] Task 04 - Temporal Integration
- [x] Task 05 - Database Schema
- [x] Task 06 - Task Manager
- [x] Task 07 - SDK Workflow Helpers

### Phase 3: Interfaces 🟡

- [x] Task 08 - MCP Server
- [x] Task 09 - REST API

### Phase 4: Dashboard 🟠

- [x] Task 10 - Dashboard UI
- [x] Task 11 - Dashboard Backend
- [x] Task 12 - Notification Service
- [x] Task 20 - User Management (CRUD)
- [x] Task 21 - Group Management
- [x] Task 22 - Admin Settings Page
- [x] Task 23 - Toast Notifications
- [x] Task 24 - Dark Mode Toggle

### Phase 5: Developer Experience 🔴

- [x] Task 13 - CLI Tool
- [x] Task 14 - Integration Testing
- [x] Task 15 - Documentation
- [ ] Task 16 - Release Preparation

### Phase 6: Examples 🟣

- [x] Task 17 - Example Project (Support Bot)
- [x] Task 18 - Workflow Agent

### Phase 7: Advanced Features 🌟

- [ ] Task 19 - Custom UI Rendering

---

## How to Work on This Project

### Development Environment (IMPORTANT)

This project uses **Nix flakes** for reproducible development environments.

**CRITICAL: Always run commands inside the Nix shell:**

```bash
# Enter the Nix development shell FIRST
nix develop

# Or if using direnv (recommended), it auto-loads when you cd into the project
direnv allow
```

All commands below assume you are inside `nix develop`. The flake provides:

- Node.js 20
- pnpm
- Docker & docker-compose
- PostgreSQL client tools

### For Claude (AI Agent)

1. **Always use `nix develop`** - Prefix commands with `nix develop --command` or enter the shell first
2. **Read the task index**: `docs/tasks/00 - Task Index.md`
3. **Find the next incomplete task** from the progress list above
4. **Read that task file** completely before starting
5. **Implement following the acceptance criteria**
6. **Test your implementation** (run builds, tests as specified)
7. **Mark the task complete** in this file
8. **Move to the next task**

### Important Guidelines

- **ALWAYS use the Nix environment** - Run `nix develop --command <cmd>` for all shell commands
- **Follow the dependency order** - Don't skip ahead; tasks build on each other
- **Use the exact tech stack specified** - pnpm, TypeScript, Temporal, etc.
- **Check acceptance criteria** - Every checkbox should pass before moving on
- **Ask if blocked** - If something is unclear or impossible, explain why
- **Commit frequently** - Make atomic commits after completing logical units

### Commands You'll Use Often

```bash
# IMPORTANT: Always run inside nix develop!
# Option 1: Enter the shell
nix develop

# Option 2: Run single commands
nix develop --command pnpm install

# Package management (inside nix develop)
pnpm install
pnpm add <package> --filter <workspace>

# Development
pnpm dev                    # Start all services
docker-compose up -d        # Start infrastructure

# Building
pnpm build                  # Build all packages
pnpm build --filter core    # Build specific package

# Testing
pnpm test                   # Run all tests
pnpm test:integration       # Integration tests

# Code quality
pnpm lint
pnpm typecheck
```

---

## Key Design Decisions

### Why Temporal?

- Durable execution (survives crashes)
- Built-in retries, timeouts, and error handling
- Time-based triggers for SLAs
- Signals for human task completion
- Battle-tested at scale

### Why MCP as Primary AI Interface?

- Native integration with Claude and other AI models
- Tools and resources pattern fits orchestration perfectly
- Standardized protocol for AI-backend communication

### Why Code-First Workflows?

- Version controlled
- Testable
- Type-safe
- No visual editor lock-in

### Why Multi-Tenant by Default?

- Most real applications need it
- Harder to add later than to build in from start
- Enforced at type level prevents accidents

---

## Example: What a Workflow Looks Like

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
    sla: timeout('30m'), // Escalate if not handled in 30 min
  });

  return { answer: result.data.answer, handledBy: 'human' };
});
```

---

## Reference Documentation

- `docs/` - User documentation (VitePress site)
  - Getting Started: Installation, Quick Start, First Workflow
  - Concepts: Architecture, Workflows, Tasks, Multi-tenancy, SLA & Escalation
  - Guides: Writing Workflows, Form Schemas, Assignment Strategies, Notifications, Deployment
  - API Reference: MCP Tools, REST API, SDK Reference, CLI Reference
  - Examples: Support Bot, Approval Workflow, Sales Pipeline
- `docs/PROJECT.md` - Full project overview
- `docs/Architecture.md` - Detailed technical architecture
- `docs/tasks/` - All implementation tasks

**To view documentation locally:**

```bash
cd docs
nix develop --command pnpm run docs:dev
# Visit http://localhost:5173
```

## External References

- [Temporal TypeScript SDK](https://docs.temporal.io/dev-guide/typescript)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [tRPC](https://trpc.io/)
- [Prisma](https://www.prisma.io/)

---

## Notes

- This is an **open-source project** (MIT license planned)
- Target audience: Developers building AI-powered applications that need human oversight
- The name "Orkestra" evokes orchestration of AI agents and humans

---

## Session Notes (Last Updated: 2026-01-17)

### What's Complete (20/24 tasks)

- **Core**: Types, config, errors, ID generation, Temporal integration, Prisma schema, repositories, Task Manager service, Notification service
- **SDK**: workflow(), task(), taskWithEscalation(), duration parsing, timeout/deadline utilities
- **MCP Server**: 17 tools for AI agents (workflows, tasks, conversations, users)
- **API**: Full tRPC API with auth middleware
- **CLI**: init, dev, generate, db commands + workflow agent
- **Dashboard Backend**: NextAuth + tRPC client setup
- **Dashboard Core UI**: Task inbox, task detail, task form, history page
- **Dashboard Admin UI**: User management CRUD with password hashing, group management with member controls, admin settings page
- **Dashboard UX**: Toast notifications system, dark mode toggle with system preference detection
- **Testing**: 53 unit tests + 45 integration tests
- **Examples**: Support Bot example with AI-first escalation
- **Documentation**: Comprehensive docs (30+ files) - Getting Started, Concepts, Guides, API Reference, Examples

### What's Remaining (4 tasks)

**Release & Advanced**:

- **Task 16 - Release Preparation**: Package publishing, GitHub Actions
- **Task 19 - Custom UI Rendering**: Custom UI components for human-in-the-loop tasks

### Task 23 - Toast Notifications (COMPLETED)

**Implementation**:

- Created `packages/dashboard/src/components/toast/toast-provider.tsx` with:
  - ToastProvider component with React Context
  - Toast type definitions (success, error, warning, info)
  - State management for toast array with limit (max 5)
  - Auto-dismiss functionality with timeout (5s default, 8s for errors)
  - Methods: toast(), success(), error(), warning(), info(), dismiss(), dismissAll()
  - Timeout cleanup on unmount

- Created `packages/dashboard/src/components/toast/toast.tsx` with:
  - Individual toast component with enter/exit animations
  - Icon-based visual feedback (CheckCircle2, XCircle, AlertTriangle, Info)
  - Color-coded backgrounds (emerald, red, amber, cyan)
  - Title and message display
  - Action button support
  - Dismiss button with aria-label

- Created `packages/dashboard/src/components/toast/toaster.tsx` with:
  - Container component for rendering all toasts
  - Fixed positioning in top-right corner
  - Proper stacking without overlap
  - Pointer events disabled on container

- Created `packages/dashboard/src/components/toast/index.ts` with:
  - Exports for ToastProvider, useToast, Toast, ToastComponent, Toaster
  - Type exports for Toast and ToastType

- Created `packages/dashboard/src/hooks/use-toast.ts` with:
  - Re-export of useToast hook from toast provider

- Created `packages/dashboard/src/app/test-toast/page.tsx` with:
  - Test page demonstrating all toast functionality
  - Buttons for success, error, warning, info, custom toasts
  - Toast limit test (6 toasts to verify removal of oldest)
  - Dismiss all button

- Updated `packages/dashboard/src/app/providers.tsx`:
  - Added ToastProvider wrapping the application
  - Added Toaster component for rendering toasts

**Features**:

- Toast limit of 5 visible toasts (oldest removed when limit exceeded)
- Auto-dismiss: 5 seconds default, 8 seconds for errors
- Smooth enter/exit animations (300ms duration)
- Color-coded backgrounds based on toast type
- ARIA live regions for screen reader accessibility
- Action buttons for user interactions
- Dismiss button on each toast
- Fixed positioning in top-right corner
- Pointer events don't block underlying content
- z-index ensures toasts appear above all content

### Task 24 - Dark Mode Toggle (COMPLETED)

**Implementation**:

- Created `packages/dashboard/src/hooks/use-theme.tsx` with ThemeProvider and useTheme hook
- Created `packages/dashboard/src/components/theme/theme-toggle.tsx` component with 3 buttons (light, dark, system)
- Updated `packages/dashboard/src/app/providers.tsx` to wrap with ThemeProvider
- Updated `packages/dashboard/src/app/layout.tsx` to remove hardcoded `className="dark"`
- Added ThemeToggle to `packages/dashboard/src/components/layout/header.tsx`
- Added ThemeToggle to `packages/dashboard/src/app/(protected)/layout.tsx`

**Features**:

- Theme persistence to localStorage (key: 'orkestra-theme')
- System theme preference detection with `window.matchMedia('(prefers-color-scheme: dark)')`
- System theme changes listener for automatic updates
- Smooth theme switching without page reload
- Tailwind dark mode classes work correctly with class-based strategy
- Active state visual feedback on toggle buttons
- Accessibility with title attributes

### Known Issues Fixed This Session

- **docker-compose.yml**: Changed `DB=postgresql` to `DB=postgres12` (Temporal requires this exact driver name)

### What Was Implemented This Session

**Task 23 - Toast Notifications**:

- Created `packages/dashboard/src/components/toast/toast-provider.tsx` with:
  - ToastProvider component with React Context
  - Toast type definitions (success, error, warning, info)
  - State management for toast array with limit (max 5)
  - Auto-dismiss functionality with timeout (5s default, 8s for errors)
  - Methods: toast(), success(), error(), warning(), info(), dismiss(), dismissAll()
  - Timeout cleanup on unmount
  - TypeScript types for Toast and ToastContextType

- Created `packages/dashboard/src/components/toast/toast.tsx` with:
  - Individual toast component with enter/exit animations
  - Icon-based visual feedback (CheckCircle2, XCircle, AlertTriangle, Info)
  - Color-coded backgrounds (emerald, red, amber, cyan)
  - Title and message display
  - Action button support
  - Dismiss button with aria-label
  - ARIA live region for accessibility

- Created `packages/dashboard/src/components/toast/toaster.tsx` with:
  - Container component for rendering all toasts
  - Fixed positioning in top-right corner (z-50)
  - Proper stacking without overlap
  - Pointer events disabled on container

- Created `packages/dashboard/src/components/toast/index.ts` with:
  - Exports for ToastProvider, useToast, ToastType, Toast, ToastComponent, Toaster

- Created `packages/dashboard/src/hooks/use-toast.ts` with:
  - Re-export of useToast hook for easy importing

- Created `packages/dashboard/src/app/test-toast/page.tsx` with:
  - Test page demonstrating all toast functionality
  - Buttons for success, error, warning, info, custom toasts
  - Toast limit test (6 toasts to verify removal of oldest)
  - Dismiss all button

- Updated `packages/dashboard/src/app/providers.tsx`:
  - Added ToastProvider wrapping the TRPCProvider
  - Added Toaster component for rendering toasts

All code passes ESLint checks and follows TypeScript best practices.

**Task 24 - Dark Mode Toggle**:

- Created `packages/dashboard/src/hooks/use-theme.tsx` with:
  - ThemeProvider component with React Context
  - useTheme() hook for accessing theme state
  - setTheme() method to set specific theme
  - toggleTheme() method to switch between light/dark
  - Theme persistence to localStorage (key: 'orkestra-theme')
  - System theme preference detection and listener
  - Automatic CSS class management on html element

- Created `packages/dashboard/src/components/theme/theme-toggle.tsx` with:
  - Three-button interface (Sun/Moon/Monitor icons)
  - Light mode button
  - Dark mode button
  - System theme button
  - Active state visual feedback
  - Accessibility title attributes

- Updated `packages/dashboard/src/app/providers.tsx`:
  - Added ThemeProvider to wrap application

- Updated `packages/dashboard/src/app/layout.tsx`:
  - Removed hardcoded `className="dark"`
  - Kept `suppressHydrationWarning` for smooth theme transitions

- Updated `packages/dashboard/src/components/layout/header.tsx`:
  - Added ThemeToggle component to header

- Updated `packages/dashboard/src/app/(protected)/layout.tsx`:
  - Added ThemeToggle component to protected layout header

All code passes ESLint checks and follows TypeScript best practices.

### How to Test Now

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Build all packages
nix develop --command pnpm build

# 3. Run tests
nix develop --command pnpm test
nix develop --command pnpm test:integration --filter @orkestra/core

# 4. Try the CLI
nix develop --command node packages/cli/bin/orkestra.js --help

# 5. Run example (in examples/support-bot/)
nix develop --command pnpm dev
```

### Dashboard UI is Optional

The system is fully functional without Dashboard UI. Tasks can be completed via:

- REST API: `POST /trpc/task.complete`
- MCP tools programmatically
- Custom UI

### New Task Added: Custom UI Rendering (Task 19)

Task 19 has been added to the roadmap to enable custom UI rendering for human-in-the-loop workflows. This is inspired by Vercel's json-render and allows AI agents to generate rich, dynamic interfaces beyond simple forms.

**Key features**:

- Guardrailed component catalog (AI can only use defined components)
- Predictable JSON UI trees validated by Zod schemas
- Data binding to task context and form data
- Conditional visibility based on data/auth/logic
- Actions that trigger workflow callbacks
- Built-in component library (Card, TextField, DataTable, Button, etc.)

**Use cases**:

- Document review with diff viewers
- Data selection with filterable tables
- Visual approval with charts/graphs
- Multi-step wizards with conditional logic

This task creates 3 new packages:

- `@orkestra/ui-renderer`: Core logic (validation, data binding, visibility)
- `@orkestra/ui-renderer-react`: React renderer with contexts and hooks
- `@orkestra/ui-components`: Built-in component library
