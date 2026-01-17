# Task 16: Release Preparation

## Overview

Prepare Orkestra for open-source release: versioning, changelog, licensing, and npm publishing.

## Phase

🔴 **Phase 5: Developer Experience**

## Priority

🟢 **Medium** - Final step before launch

## Estimated Effort

4-6 hours

## Description

Set up the infrastructure for releasing Orkestra as open-source packages on npm, including versioning, changelogs, and CI/CD for publishing.

## Requirements

### Versioning with Changesets

```bash
pnpm add -D @changesets/cli
pnpm changeset init
```

```json
// .changeset/config.json
{
  "changelog": "@changesets/changelog-github",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

### Package Configuration

Each package needs proper npm configuration:

```json
// packages/core/package.json
{
  "name": "@orkestra/core",
  "version": "0.1.0",
  "description": "Orkestra core - AI-native workflow orchestration",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md"
  ],
  "keywords": [
    "orkestra",
    "workflow",
    "temporal",
    "bpm",
    "human-in-the-loop",
    "mcp",
    "ai"
  ],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/orkestra.git",
    "directory": "packages/core"
  },
  "bugs": {
    "url": "https://github.com/yourusername/orkestra/issues"
  },
  "homepage": "https://github.com/yourusername/orkestra#readme",
  "publishConfig": {
    "access": "public"
  }
}
```

### Build Configuration

```typescript
// packages/core/tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  external: ['@prisma/client'],
});
```

### License Files

Create MIT license in root:

```
MIT License

Copyright (c) 2024 [Your Name]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### CI/CD Publishing

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches:
      - main

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Build packages
        run: pnpm build

      - name: Run tests
        run: pnpm test

      - name: Create Release Pull Request or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: pnpm release
          version: pnpm version
          commit: 'chore: release packages'
          title: 'chore: release packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Root Package Scripts

```json
// package.json
{
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "changeset": "changeset",
    "version": "changeset version",
    "release": "pnpm build && changeset publish"
  }
}
```

### README Badges

```markdown
# Orkestra

[![npm version](https://badge.fury.io/js/@orkestra%2Fcore.svg)](https://www.npmjs.com/package/@orkestra/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/yourusername/orkestra/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/orkestra/actions/workflows/ci.yml)

...
```

### CHANGELOG.md Template

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Orkestra
- Core workflow engine with Temporal integration
- MCP server for AI agent integration
- Task management with human-in-the-loop
- Multi-tenant support
- Dashboard for task management
- CLI for project scaffolding

### Changed

### Deprecated

### Removed

### Fixed

### Security
```

### Contributing Guide

```markdown
# Contributing to Orkestra

Thank you for your interest in contributing to Orkestra!

## Development Setup

1. Fork and clone the repository
2. Install dependencies: `pnpm install`
3. Start development: `npx orkestra dev`

## Making Changes

1. Create a branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Add tests for new functionality
4. Run tests: `pnpm test`
5. Create a changeset: `pnpm changeset`
6. Commit and push
7. Open a Pull Request

## Changesets

We use [Changesets](https://github.com/changesets/changesets) for versioning.

When making changes, run:

\`\`\`bash
pnpm changeset
\`\`\`

This will prompt you to:
- Select which packages are affected
- Choose the type of change (major/minor/patch)
- Write a summary of the change

## Code Style

- We use ESLint and Prettier
- Run `pnpm lint` to check
- Run `pnpm lint:fix` to auto-fix

## Testing

- Unit tests: `pnpm test`
- Integration tests: `pnpm test:integration`

## Pull Request Guidelines

- Include tests for new features
- Update documentation as needed
- Include a changeset for user-facing changes
- Keep PRs focused on a single concern
```

### Security Policy

```markdown
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

Please report security vulnerabilities to security@orkestra.io.

Do not disclose security vulnerabilities publicly until they have been addressed.

We will respond within 48 hours and provide a timeline for the fix.
```

## Acceptance Criteria

- [ ] Changesets configured
- [ ] All packages have proper package.json
- [ ] Build produces correct artifacts
- [ ] License files in place
- [ ] CI/CD workflow configured
- [ ] NPM publishing works
- [ ] README has badges
- [ ] CHANGELOG.md created
- [ ] CONTRIBUTING.md created
- [ ] SECURITY.md created
- [ ] Code of Conduct added

## Dependencies

- [[01 - Initialize Monorepo]]
- [[14 - Integration Testing]]
- [[15 - Documentation]]

## Blocked By

- [[15 - Documentation]]

## Blocks

- [[17 - Example Project]]

## Technical Notes

### NPM Token Setup

1. Create npm account
2. Generate automation token
3. Add to GitHub secrets as `NPM_TOKEN`

### Package Naming

All packages use `@orkestra/` scope:
- `@orkestra/core`
- `@orkestra/sdk`
- `@orkestra/mcp-server`
- `@orkestra/api`
- `@orkestra/dashboard`
- `@orkestra/cli`

### Version Strategy

- Major: Breaking changes
- Minor: New features (backward compatible)
- Patch: Bug fixes

## References

- [Changesets](https://github.com/changesets/changesets)
- [tsup](https://tsup.egoist.dev/)
- [npm Publishing](https://docs.npmjs.com/packages-and-modules)

## Tags

#orkestra #task #release #npm #open-source
