# Installation

This guide covers all installation options for Orkestra.

## Prerequisites

Before installing Orkestra, ensure you have:

- **Node.js** 20 or later
- **pnpm** 8 or later (recommended) or npm/yarn
- **Docker** and **Docker Compose** for local development
- **PostgreSQL** 14+ (or use the Docker setup)

## Quick Install (Recommended)

The fastest way to get started is using the Orkestra CLI:

```bash
# Create a new project
npx @orkestra/cli init my-app

# Navigate to the project
cd my-app

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Temporal)
docker-compose up -d

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

## Manual Installation

If you prefer to add Orkestra to an existing project:

### 1. Install Core Packages

```bash
# Core orchestration engine
pnpm add @orkestra/core

# SDK for writing workflows
pnpm add @orkestra/sdk

# API layer (optional)
pnpm add @orkestra/api

# MCP server for AI integration (optional)
pnpm add @orkestra/mcp-server
```

### 2. Install Peer Dependencies

```bash
# Temporal SDK
pnpm add @temporalio/client @temporalio/worker @temporalio/workflow

# Database
pnpm add @prisma/client
pnpm add -D prisma

# API dependencies (if using @orkestra/api)
pnpm add @trpc/server zod
```

### 3. Configure TypeScript

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  }
}
```

### 4. Set Up Infrastructure

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: orkestra
      POSTGRES_PASSWORD: orkestra
      POSTGRES_DB: orkestra
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  temporal:
    image: temporalio/auto-setup:1.24
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=orkestra
      - POSTGRES_PWD=orkestra
      - POSTGRES_SEEDS=postgres
    ports:
      - "7233:7233"
    depends_on:
      - postgres

  temporal-ui:
    image: temporalio/ui:2.26.2
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
    ports:
      - "8080:8080"
    depends_on:
      - temporal

volumes:
  postgres_data:
```

### 5. Configure Environment

Create a `.env` file:

```bash
# Database
DATABASE_URL="postgresql://orkestra:orkestra@localhost:5432/orkestra"

# Temporal
TEMPORAL_ADDRESS="localhost:7233"
TEMPORAL_NAMESPACE="default"

# API
API_PORT=3000
API_SECRET="your-secret-key-here"

# Optional: Langfuse for observability
# LANGFUSE_PUBLIC_KEY=""
# LANGFUSE_SECRET_KEY=""
# LANGFUSE_HOST=""
```

## Package Versions

Current stable versions:

| Package | Version |
|---------|---------|
| @orkestra/core | 0.0.1 |
| @orkestra/sdk | 0.0.1 |
| @orkestra/api | 0.0.1 |
| @orkestra/mcp-server | 0.0.1 |
| @orkestra/cli | 0.0.1 |
| @orkestra/dashboard | 0.0.1 |

## Nix Users

If you use Nix, a `flake.nix` is provided for reproducible development:

```bash
# Enter development shell
nix develop

# Or with direnv
direnv allow
```

The Nix flake provides:
- Node.js 20
- pnpm
- Docker & docker-compose
- PostgreSQL client tools

## Verifying Installation

After installation, verify everything is working:

```bash
# Check Temporal is running
curl -s http://localhost:7233/api/v1/namespaces/default | jq .

# Check PostgreSQL connection
pnpm prisma db pull

# Run a simple test
pnpm test
```

## Troubleshooting

### Docker Issues

**Temporal fails to start:**
```bash
# Check Temporal logs
docker-compose logs temporal

# Restart services
docker-compose down && docker-compose up -d
```

**Port conflicts:**
```bash
# Check what's using the port
lsof -i :7233
lsof -i :5432
```

### Database Issues

**Migration errors:**
```bash
# Reset database (development only)
pnpm prisma migrate reset

# Generate fresh client
pnpm prisma generate
```

### TypeScript Issues

**Module resolution errors:**
Ensure your `package.json` has:
```json
{
  "type": "module"
}
```

## Next Steps

- [Quick Start Guide](./quick-start.md) - Get running in 5 minutes
- [First Workflow](./first-workflow.md) - Create your first workflow
- [Architecture](../concepts/architecture.md) - Understand how it works
