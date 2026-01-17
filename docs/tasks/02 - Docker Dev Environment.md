# Task 02: Docker Development Environment

## Overview

Create a Docker Compose setup for local development with all required services.

## Phase

🔵 **Phase 1: Foundation**

## Priority

🔴 **Critical** - Required for development

## Estimated Effort

2-3 hours

## Description

Set up a complete Docker Compose environment that spins up all external services needed for Orkestra development: PostgreSQL, Temporal, and optional Langfuse.

## Requirements

### Docker Compose Services

1. **PostgreSQL 15**
   - Port: 5432
   - Database: orkestra_dev
   - User: orkestra
   - Password: orkestra_dev (local only)

2. **Temporal Server**
   - Port: 7233 (gRPC)
   - Port: 8080 (Web UI)
   - Use official `temporalio/auto-setup` image
   - Configure with PostgreSQL backend

3. **Langfuse (optional)**
   - Port: 3333
   - For local observability testing
   - Can be disabled by default

### docker-compose.yml Structure

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: orkestra
      POSTGRES_PASSWORD: orkestra_dev
      POSTGRES_DB: orkestra_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U orkestra"]
      interval: 5s
      timeout: 5s
      retries: 5

  temporal:
    image: temporalio/auto-setup:latest
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=orkestra
      - POSTGRES_PWD=orkestra_dev
      - POSTGRES_SEEDS=postgres
    ports:
      - "7233:7233"
    # ... additional config

  temporal-ui:
    image: temporalio/ui:latest
    depends_on:
      - temporal
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
    ports:
      - "8080:8080"

volumes:
  postgres_data:
```

### Init Scripts

Create `scripts/init-db.sql` for:
- Creating additional databases if needed
- Setting up Temporal database
- Any initial schema setup

### Environment Files

```
.env.example
.env.local (gitignored)
```

## Acceptance Criteria

- [ ] `docker-compose up` starts all services
- [ ] PostgreSQL accessible on localhost:5432
- [ ] Temporal server accessible on localhost:7233
- [ ] Temporal UI accessible on localhost:8080
- [ ] Services have proper health checks
- [ ] Data persists across restarts (volumes)
- [ ] Clean shutdown with `docker-compose down`
- [ ] `.env.example` documented
- [ ] README section on Docker setup

## Dependencies

- [[01 - Initialize Monorepo]]

## Blocked By

None (can work in parallel with Task 01)

## Blocks

- [[03 - Core Package Setup]]
- [[05 - Database Schema]]

## Technical Notes

### Temporal Auto-Setup

The `temporalio/auto-setup` image handles:
- Database schema creation
- Default namespace creation
- Service startup

For production, you'd use separate images and manage schema migrations.

### PostgreSQL for Both

Using single PostgreSQL instance for:
- Temporal persistence
- Orkestra application data

In production, these might be separate.

### Port Conflicts

Common conflicts to watch:
- 5432: PostgreSQL (conflict with local Postgres)
- 8080: Temporal UI (conflict with many services)

Consider adding port override via env vars:
```yaml
ports:
  - "${POSTGRES_PORT:-5432}:5432"
```

## References

- [Temporal Docker Compose](https://github.com/temporalio/docker-compose)
- [PostgreSQL Docker](https://hub.docker.com/_/postgres)

## Tags

#orkestra #task #foundation #docker #temporal #postgres
