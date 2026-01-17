# Task 01: Initialize Monorepo

## Overview

Set up the monorepo structure for Orkestra using modern TypeScript tooling.

## Phase

🔵 **Phase 1: Foundation**

## Priority

🔴 **Critical** - Must be done first

## Estimated Effort

2-4 hours

## Description

Create the initial monorepo structure with proper tooling for a multi-package TypeScript project. This establishes the foundation for all other packages.

## Requirements

### Monorepo Setup

1. Initialize with pnpm workspaces (preferred for performance)
2. Set up Turborepo for build orchestration
3. Configure TypeScript with project references
4. Set up ESLint and Prettier with shared configs
5. Configure Vitest for testing

### Folder Structure

```
orkestra/
├── packages/
│   ├── core/
│   ├── sdk/
│   ├── mcp-server/
│   ├── api/
│   ├── dashboard/
│   └── cli/
├── examples/
├── docs/
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .eslintrc.js
├── .prettierrc
└── vitest.config.ts
```

### Package.json Scripts

```json
{
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean"
  }
}
```

### TypeScript Configuration

- Use `tsconfig.base.json` with strict settings
- Each package extends base config
- Enable project references for incremental builds
- Target ES2022, module NodeNext

## Acceptance Criteria

- [ ] Monorepo initialized with pnpm workspaces
- [ ] Turborepo configured with pipeline for build/dev/test
- [ ] TypeScript configured with strict mode and project references
- [ ] ESLint configured with TypeScript plugin
- [ ] Prettier configured
- [ ] Vitest configured for unit testing
- [ ] All packages have basic `package.json` (placeholder)
- [ ] `pnpm install` works without errors
- [ ] `pnpm build` runs (even if packages are empty)

## Dependencies

None - this is the first task

## Blocked By

None

## Blocks

All other tasks

## Technical Notes

### Recommended Versions

- Node.js: 20 LTS
- pnpm: 8.x
- TypeScript: 5.3+
- Turborepo: 1.11+
- Vitest: 1.x

### Turborepo Pipeline

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

## References

- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Turborepo Docs](https://turbo.build/repo/docs)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)

## Tags

#orkestra #task #foundation #monorepo #typescript
