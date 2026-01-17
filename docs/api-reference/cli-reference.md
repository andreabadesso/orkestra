# CLI Reference

The Orkestra CLI provides command-line tools for project initialization, development, code generation, database management, and AI-powered workflow building.

## Installation

The CLI is bundled with the `@orkestra/sdk` package:

```bash
npm install -g @orkestra/sdk

# Or use npx without installing
npx orkestra --help
```

## Global Options

| Option          | Description      |
| --------------- | ---------------- |
| `-v, --version` | Show CLI version |
| `-h, --help`    | Show help        |

---

## `orkestra init`

Initialize a new Orkestra project.

### Usage

```bash
orkestra init [name] [options]
```

### Arguments

| Name   | Type   | Required | Description  |
| ------ | ------ | -------- | ------------ |
| `name` | string | No       | Project name |

### Options

| Option              | Default  | Description                            |
| ------------------- | -------- | -------------------------------------- |
| `-y, --yes`         | false    | Skip prompts and use defaults          |
| `--database <type>` | postgres | Database type (`postgres` or `sqlite`) |
| `--no-dashboard`    | true     | Skip dashboard setup                   |
| `--no-examples`     | true     | Skip example workflows                 |

### Examples

**Interactive mode:**

```bash
orkestra init
# Prompts for project name, database, etc.
```

**Non-interactive with defaults:**

```bash
orkestra init my-app --yes
```

**Specify database type:**

```bash
orkestra init my-app --database sqlite
```

**Skip dashboard and examples:**

```bash
orkestra init my-app --no-dashboard --no-examples
```

### What It Creates

```
my-app/
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── .env
├── .env.example
├── .gitignore
├── src/
│   ├── workflows/
│   │   ├── index.ts
│   │   └── example.ts          # If --examples
│   ├── activities/
│   │   ├── index.ts
│   │   └── example.ts          # If --examples
│   └── worker.ts
└── README.md
```

### Generated Files

**package.json:**

```json
{
  "name": "my-app",
  "dependencies": {
    "@orkestra/sdk": "latest",
    "@orkestra/core": "latest",
    "@temporalio/worker": "latest",
    "@temporalio/workflow": "latest"
  },
  "devDependencies": {
    "tsx": "latest",
    "typescript": "latest"
  },
  "scripts": {
    "dev": "tsx watch src/worker.ts",
    "build": "tsc"
  }
}
```

**docker-compose.yml:**

```yaml
services:
  postgres:
    image: postgres:15
    ports:
      - '5432:5432'
  temporal:
    image: temporalio/auto-setup:latest
    ports:
      - '7233:7233'
      - '8080:8080'
```

### Next Steps

After project initialization:

```bash
cd my-app
pnpm install
docker-compose up -d
pnpm dev
```

---

## `orkestra dev`

Start development environment with Docker services, Temporal worker, and API server.

### Usage

```bash
orkestra dev [options]
```

### Options

| Option          | Default | Description          |
| --------------- | ------- | -------------------- |
| `--no-docker`   | true    | Skip Docker services |
| `--no-worker`   | true    | Skip Temporal worker |
| `--no-api`      | true    | Skip API server      |
| `--port <port>` | 3000    | API server port      |

### Examples

**Start all services:**

```bash
orkestra dev
```

**Start without Docker:**

```bash
orkestra dev --no-docker
```

**Start with custom API port:**

```bash
orkestra dev --port 4000
```

**Skip worker and API (Docker only):**

```bash
orkestra dev --no-worker --no-api
```

### What It Does

1. **Checks Docker**: Verifies Docker and Docker Compose are running
2. **Starts Services**: Launches PostgreSQL and Temporal if not running
3. **Starts Worker**: Runs Temporal worker with hot reload (tsx watch)
4. **Starts API**: Launches API server if `src/api.ts` exists

### Service URLs

When all services are running:

| Service         | URL                           |
| --------------- | ----------------------------- |
| PostgreSQL      | `postgresql://localhost:5432` |
| Temporal Server | `localhost:7233`              |
| Temporal UI     | `http://localhost:8080`       |
| API Server      | `http://localhost:3000`       |

### Graceful Shutdown

Press `Ctrl+C` to stop all services. The CLI handles graceful shutdown of child processes.

---

## `orkestra generate`

Generate workflow or activity files from templates.

### Usage

```bash
orkestra generate <type> [name] [options]
orkestra g <type> [name] [options]
```

### Subcommands

#### `orkestra generate workflow`

Generate a new workflow file.

```bash
orkestra generate workflow <name> [options]
```

**Arguments:**

| Name   | Type   | Required | Description   |
| ------ | ------ | -------- | ------------- |
| `name` | string | Yes      | Workflow name |

**Options:**

| Option        | Default | Description                |
| ------------- | ------- | -------------------------- |
| `--with-task` | false   | Include human task example |
| `-f, --force` | false   | Overwrite existing file    |

**Examples:**

```bash
# Generate basic workflow
orkestra generate workflow customer-support

# Generate workflow with task example
orkestra generate workflow document-review --with-task

# Overwrite existing file
orkestra generate workflow order-processing --force
```

**Generated Template (basic):**

```typescript
import { workflow } from '@orkestra/sdk';

export const customerSupport = workflow('customer-support', async (ctx, input: unknown) => {
  // TODO: Implement workflow logic
  return { success: true };
});
```

**Generated Template (with task):**

```typescript
import { workflow, task, timeout } from '@orkestra/sdk';

export const documentReview = workflow('document-review', async (ctx, input: unknown) => {
  const result = await task(ctx, {
    title: 'Review Document',
    form: {
      approved: { type: 'boolean', required: true },
      notes: { type: 'textarea' },
    },
    assignTo: { group: 'reviewers' },
    sla: timeout('1h'),
  });

  return { approved: result.data.approved };
});
```

#### `orkestra generate activity`

Generate a new activity file.

```bash
orkestra generate activity <name> [options]
```

**Arguments:**

| Name   | Type   | Required | Description   |
| ------ | ------ | -------- | ------------- |
| `name` | string | Yes      | Activity name |

**Options:**

| Option        | Default | Description                |
| ------------- | ------- | -------------------------- |
| `--with-task` | false   | Include human task helpers |
| `-f, --force` | false   | Overwrite existing file    |

**Examples:**

```bash
# Generate basic activity
orkestra generate activity send-email

# Generate with task helpers
orkestra generate activity create-task --with-task
```

**Generated Template (basic):**

```typescript
/**
 * Send Email Activity
 */

export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  // TODO: Implement email sending logic
  console.log('Sending email:', input);
}
```

**Generated Template (with task):**

```typescript
/**
 * Create Task Activity
 */

import type { AssignmentTarget } from '@orkestra/sdk';

export async function createTask(input: {
  title: string;
  form: unknown;
  assignTo: AssignmentTarget;
}): Promise<string> {
  // TODO: Implement task creation logic
  const taskId = 'task_' + Date.now();
  return taskId;
}
```

### File Location

Generated files are placed in:

- Workflows: `src/workflows/<name>.ts`
- Activities: `src/activities/<name>.ts`

### Export Required

After generating, remember to export from the index file:

```typescript
// src/workflows/index.ts
export * from './customer-support.js';
export * from './document-review.js';

// src/activities/index.ts
export * from './send-email.js';
```

---

## `orkestra db`

Database management commands wrapping Prisma CLI.

### Usage

```bash
orkestra db <command> [options]
```

### Subcommands

#### `orkestra db migrate`

Run database migrations.

```bash
orkestra db migrate [options]
```

**Options:**

| Option          | Description                                |
| --------------- | ------------------------------------------ |
| `--name <name>` | Migration name                             |
| `--dev`         | Run in development mode (create and apply) |

**Examples:**

```bash
# Development: create and apply migration
orkestra db migrate --dev --name add_task_priority

# Production: apply existing migrations
orkestra db migrate
```

#### `orkestra db push`

Push schema changes to database (without migration files).

```bash
orkestra db push [options]
```

**Options:**

| Option          | Description                   |
| --------------- | ----------------------------- |
| `--force-reset` | Reset database before pushing |

**Examples:**

```bash
# Push schema changes
orkestra db push

# Push with database reset
orkestra db push --force-reset
```

#### `orkestra db studio`

Open Prisma Studio database viewer.

```bash
orkestra db studio [options]
```

**Options:**

| Option          | Default | Description            |
| --------------- | ------- | ---------------------- |
| `--port <port>` | 5555    | Port for Prisma Studio |

**Examples:**

```bash
# Open studio on default port
orkestra db studio

# Open studio on custom port
orkestra db studio --port 6000
```

Opens Prisma Studio in your browser at `http://localhost:5555`.

#### `orkestra db seed`

Run database seed script.

```bash
orkestra db seed
```

**Examples:**

```bash
orkestra db seed
```

Looks for seed file at:

- `prisma/seed.ts`
- `prisma/seed.js`

#### `orkestra db generate`

Generate Prisma Client.

```bash
orkestra db generate
```

**Examples:**

```bash
orkestra db generate
```

Generates Prisma Client based on schema at `prisma/schema.prisma`.

---

## `orkestra workflow`

AI-powered workflow builder using Claude.

### Usage

```bash
orkestra workflow [prompt] [options]
```

### Arguments

| Name     | Type   | Required | Description                          |
| -------- | ------ | -------- | ------------------------------------ |
| `prompt` | string | No       | Initial prompt to start conversation |

### Options

| Option                  | Default                  | Description                               |
| ----------------------- | ------------------------ | ----------------------------------------- |
| `-v, --verbose`         | false                    | Show verbose output including tool inputs |
| `--model <model>`       | claude-sonnet-4-20250514 | Claude model to use                       |
| `--max-tokens <tokens>` | 4096                     | Maximum tokens for response               |
| `--project <path>`      | .                        | Path to project                           |

### Examples

**Interactive mode:**

```bash
orkestra workflow
# Starts interactive conversation with AI
```

**With initial prompt:**

```bash
orkestra workflow "Create an expense approval workflow with 2-level approval chain"
```

**Verbose mode:**

```bash
orkestra workflow -v
```

**Specify project path:**

```bash
orkestra workflow --project /path/to/project
```

**Custom model:**

```bash
orkestra workflow --model claude-opus-4-20250514
```

### Prerequisites

The workflow agent requires:

1. **Orkestra project**: Must be in a directory with:
   - `package.json` with `@orkestra/sdk` or `@orkestra/core` dependency, OR
   - `src/workflows` directory

2. **Anthropic API Key**: Set environment variable:

   ```bash
   export ANTHROPIC_API_KEY=your-api-key-here
   ```

   Get an API key at: https://console.anthropic.com/

### What It Can Do

The workflow agent can help you:

- **Create new workflows**: Design workflows with human tasks
- **Add escalation chains**: Configure multi-level escalation
- **Understand SDK patterns**: Use best practices from the SDK
- **Analyze existing workflows**: Review and suggest improvements
- **Generate code**: Write workflow and activity code
- **Debug issues**: Help troubleshoot workflow problems

### Interactive Features

When running in interactive mode, the agent can:

1. **Create files**: Generate workflow and activity files
2. **Edit files**: Update existing code
3. **Read code**: Analyze your project structure
4. **Validate**: Check code for errors
5. **Provide examples**: Show relevant code patterns

### Session Example

```bash
$ orkestra workflow "Create a support ticket workflow"

🤖 Orkestra Workflow Agent

I'll help you create a support ticket workflow with human tasks and escalation.

Let me analyze the requirements and generate the workflow...

> Created: src/workflows/support-ticket.ts
> Created: src/activities/handle-ticket.ts

The workflow includes:
- Automatic task creation for support tickets
- SLA-based escalation (1h -> 4h -> 24h)
- Tier-based timeouts by customer type
- Conversation tracking

Would you like me to add anything else?

> Add a manager approval step for tickets over $1000

> Updated: src/workflows/support-ticket.ts

Added manager approval workflow step that triggers when ticket value exceeds $1000.

Is there anything else you'd like to add?
```

### Tool Context

The workflow agent has access to tools for:

- **File operations**: Read, write, and create files
- **Code generation**: Create workflows and activities
- **Project analysis**: Understand existing code structure
- **SDK knowledge**: Access SDK documentation and patterns

---

## Configuration

### Environment Variables

The CLI and project use these environment variables:

**Database:**

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/orkestra"
```

**Temporal:**

```bash
TEMPORAL_ADDRESS="localhost:7233"
TEMPORAL_NAMESPACE="default"
```

**API:**

```bash
PORT="3000"
NODE_ENV="development"
```

**API Keys:**

```bash
ANTHROPIC_API_KEY="your-anthropic-api-key"
```

### Project Configuration

**package.json scripts:**

```json
{
  "scripts": {
    "dev": "tsx watch src/worker.ts",
    "build": "tsc",
    "start": "node dist/worker.js"
  }
}
```

---

## Troubleshooting

### Docker Issues

**Docker not running:**

```bash
$ orkestra dev
❌ Docker is not running

Solution:
# Start Docker Desktop
open -a Docker  # macOS
# Or start Docker service (Linux)
sudo systemctl start docker
```

**Port already in use:**

```bash
$ orkestra dev
❌ Port 5432 already in use

Solution:
# Stop conflicting service
docker-compose down

# Or change ports in docker-compose.yml
```

### Worker Issues

**Worker not starting:**

```bash
$ orkestra dev
❌ No worker file found

Solution:
# Ensure src/worker.ts exists
orkestra generate workflow example

# Or skip worker
orkestra dev --no-worker
```

**Connection refused:**

```bash
❌ Failed to connect to Temporal

Solution:
# Check Temporal is running
docker-compose ps

# Check Temporal logs
docker-compose logs temporal
```

### Database Issues

**Migration failed:**

```bash
$ orkestra db migrate --dev
❌ Migration failed

Solution:
# Check database is running
docker-compose ps postgres

# Reset database (DEVELOPMENT ONLY)
orkestra db push --force-reset
```

**Seed failed:**

```bash
$ orkestra db seed
❌ No seed file found

Solution:
# Create prisma/seed.ts
touch prisma/seed.ts

# Or skip seeding (optional)
```

### Workflow Agent Issues

**API key not set:**

```bash
$ orkestra workflow
❌ ANTHROPIC_API_KEY not set

Solution:
export ANTHROPIC_API_KEY=your-api-key-here
```

**Not in Orkestra project:**

```bash
$ orkestra workflow
❌ Could not find Orkestra project

Solution:
# Initialize a project
orkestra init my-app
cd my-app

# Or specify project path
orkestra workflow --project /path/to/project
```

---

## Implementation Reference

- CLI Source: `packages/cli/src/`
  - Init: `commands/init.ts:34-273`
  - Dev: `commands/dev.ts:41-209`
  - Generate: `commands/generate.ts:148-152`
  - DB: `commands/db.ts:239-245`
  - Workflow Agent: `commands/workflow-agent.ts:14-98`
  - CLI Main: `cli.ts`
