# Orkestra Task Index

This document provides an overview of all implementation tasks for building Orkestra, organized by phase.

## Summary

| Phase | Tasks | Estimated Hours | Focus |
|-------|-------|-----------------|-------|
| Phase 1: Foundation | 3 | 8-13 | Monorepo, Docker, Core types |
| Phase 2: Core Engine | 4 | 24-32 | Temporal, DB, Tasks, SDK |
| Phase 3: Interfaces | 2 | 14-18 | MCP Server, REST API |
| Phase 4: Dashboard | 3 | 20-28 | UI, Auth, Notifications |
| Phase 5: DX | 4 | 26-34 | CLI, Tests, Docs, Release |
| Phase 6: Examples | 2 | 18-22 | Support Bot, Workflow Agent |
| **Total** | **18** | **110-147** | |

---

## Phase 1: Foundation 🔵

Establish the project infrastructure.

| # | Task | Priority | Hours | Blocked By |
|---|------|----------|-------|------------|
| 01 | [[01 - Initialize Monorepo]] | 🔴 Critical | 2-4 | None |
| 02 | [[02 - Docker Dev Environment]] | 🔴 Critical | 2-3 | None |
| 03 | [[03 - Core Package Setup]] | 🔴 Critical | 4-6 | 01 |

**Milestone**: Development environment ready, can run `pnpm install && docker-compose up`

---

## Phase 2: Core Engine 🟢

Build the core orchestration engine.

| # | Task | Priority | Hours | Blocked By |
|---|------|----------|-------|------------|
| 04 | [[04 - Temporal Integration]] | 🔴 Critical | 6-8 | 03 |
| 05 | [[05 - Database Schema]] | 🔴 Critical | 6-8 | 02, 03 |
| 06 | [[06 - Task Manager]] | 🔴 Critical | 8-10 | 04, 05 |
| 07 | [[07 - SDK Workflow Helpers]] | 🟡 High | 6-8 | 04, 06 |

**Milestone**: Can create workflows with human tasks, tasks complete and resume workflows

---

## Phase 3: Interfaces 🟡

Create API surfaces for integration.

| # | Task | Priority | Hours | Blocked By |
|---|------|----------|-------|------------|
| 08 | [[08 - MCP Server]] | 🔴 Critical | 8-10 | 06 |
| 09 | [[09 - REST API]] | 🟡 High | 6-8 | 06 |

**Milestone**: AI agents can interact via MCP, traditional apps via REST

---

## Phase 4: Dashboard 🟠

Build the human interface.

| # | Task | Priority | Hours | Blocked By |
|---|------|----------|-------|------------|
| 10 | [[10 - Dashboard UI]] | 🟡 High | 12-16 | 09, 11 |
| 11 | [[11 - Dashboard Backend]] | 🟡 High | 4-6 | 09 |
| 12 | [[12 - Notification Service]] | 🟢 Medium | 4-6 | 06 |

**Milestone**: Humans can view, claim, and complete tasks through web UI

---

## Phase 5: Developer Experience 🔴

Polish for release.

| # | Task | Priority | Hours | Blocked By |
|---|------|----------|-------|------------|
| 13 | [[13 - CLI Tool]] | 🟢 Medium | 6-8 | 01 |
| 14 | [[14 - Integration Testing]] | 🟡 High | 8-10 | 08, 09 |
| 15 | [[15 - Documentation]] | 🟡 High | 8-10 | 14 |
| 16 | [[16 - Release Preparation]] | 🟢 Medium | 4-6 | 15 |

**Milestone**: Project is documented, tested, and ready for npm publish

---

## Phase 6: Examples 🟣

Demonstrate capabilities.

| # | Task | Priority | Hours | Blocked By |
|---|------|----------|-------|------------|
| 17 | [[17 - Example Project]] | 🟡 High | 8-10 | 07 |
| 18 | [[18 - Workflow Agent]] | 🟢 Medium | 10-12 | 07, 13 |

**Milestone**: Working example that showcases full Orkestra capabilities

---

## Dependency Graph

```
Phase 1 (Foundation)
├── 01 Monorepo ─────────────────────────────────────────────────┐
│       │                                                        │
│       └──► 03 Core Types ──┬──► 04 Temporal ──┐                │
│                            │                   │                │
├── 02 Docker ───────────────┴──► 05 Database ───┤                │
│                                                │                │
Phase 2 (Core Engine)                            ▼                │
│                                          06 Task Manager        │
│                                           │         │           │
│                                           │         └──► 07 SDK │
│                                           │               │     │
Phase 3 (Interfaces)                        │               │     │
│                                           ▼               │     │
│                                     08 MCP Server         │     │
│                                           │               │     │
│                                     09 REST API           │     │
│                                           │               │     │
Phase 4 (Dashboard)                         │               │     │
│                              ┌────────────┼───────────────┘     │
│                              │            │                     │
│                        11 Auth            │                     │
│                              │            │                     │
│                        10 Dashboard UI    │                     │
│                              │            │                     │
│                        12 Notifications   │                     │
│                                           │                     │
Phase 5 (DX)                                │                     │
│                              ┌────────────┤                     │
│                              │            │                     │
│                        14 Testing         │                     │
│                              │            │                     │
│                        15 Documentation   │              13 CLI─┤
│                              │                                  │
│                        16 Release ────────┘                     │
│                                                                 │
Phase 6 (Examples)                                                │
                               17 Example Project ◄───────────────┘
                               18 Workflow Agent
```

---

## Quick Start Recommendations

### For a Solo Developer

Work through phases sequentially:
1. Complete Phase 1 (1-2 days)
2. Complete Phase 2 (4-5 days)
3. Complete Phase 3 (2-3 days)
4. Complete Phase 4 (3-4 days)
5. Complete Phase 5 (3-4 days)
6. Complete Phase 6 (2-3 days)

**Total**: ~3-4 weeks of focused work

### For a Team

Parallelize where possible:

**Week 1**:
- Dev A: Tasks 01, 03, 04
- Dev B: Tasks 02, 05

**Week 2**:
- Dev A: Task 06, 07
- Dev B: Task 08, 09

**Week 3**:
- Dev A: Tasks 10, 11
- Dev B: Tasks 12, 13

**Week 4**:
- Dev A: Task 14, 15
- Dev B: Task 16, 17, 18

---

## Priority Legend

- 🔴 **Critical** - Must have for core functionality
- 🟡 **High** - Important for completeness
- 🟢 **Medium** - Nice to have, can defer

## Phase Legend

- 🔵 Phase 1: Foundation
- 🟢 Phase 2: Core Engine
- 🟡 Phase 3: Interfaces
- 🟠 Phase 4: Dashboard
- 🔴 Phase 5: Developer Experience
- 🟣 Phase 6: Examples

---

## Using These Tasks with an AI Agent

Each task file is designed to be self-contained and passable to an AI coding agent. The structure includes:

1. **Overview** - What the task accomplishes
2. **Requirements** - Detailed specifications
3. **Acceptance Criteria** - How to verify completion
4. **Dependencies** - What must be done first
5. **Technical Notes** - Implementation hints

To use with an agent:

```bash
# Read the task
cat "Tasks/01 - Initialize Monorepo.md"

# Pass to agent with context
"Please implement the following task for the Orkestra project: [task content]"
```

## Tags

#orkestra #task-index #project-management #roadmap
