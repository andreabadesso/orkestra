# Task 13: CLI Tool

## Overview

Create the `@orkestra/cli` package for project scaffolding and development tooling.

## Phase

🔴 **Phase 5: Developer Experience**

## Priority

🟢 **Medium** - Improves DX but not blocking

## Estimated Effort

6-8 hours

## Description

Build a CLI tool that helps developers scaffold new Orkestra projects, generate workflows, and manage the development environment.

## Requirements

### Package Structure

```
packages/cli/
├── src/
│   ├── index.ts               # Entry point
│   ├── cli.ts                 # Command definitions
│   ├── commands/
│   │   ├── init.ts            # create-orkestra
│   │   ├── dev.ts             # orkestra dev
│   │   ├── generate.ts        # orkestra generate
│   │   └── db.ts              # orkestra db
│   ├── templates/
│   │   ├── project/           # Project scaffolding
│   │   └── workflow/          # Workflow templates
│   └── utils/
│       ├── fs.ts
│       ├── docker.ts
│       └── prompts.ts
├── bin/
│   └── orkestra.js
├── package.json
└── tsconfig.json
```

### CLI Setup

```typescript
// cli.ts
import { Command } from 'commander';
import { initCommand } from './commands/init';
import { devCommand } from './commands/dev';
import { generateCommand } from './commands/generate';
import { dbCommand } from './commands/db';

const program = new Command();

program
  .name('orkestra')
  .description('Orkestra CLI - AI-native workflow orchestration')
  .version('1.0.0');

program.addCommand(initCommand);
program.addCommand(devCommand);
program.addCommand(generateCommand);
program.addCommand(dbCommand);

export { program };
```

### Init Command (Project Scaffolding)

```typescript
// commands/init.ts
import { Command } from 'commander';
import inquirer from 'inquirer';
import { copyTemplate, installDependencies } from '../utils/fs';
import chalk from 'chalk';
import ora from 'ora';

export const initCommand = new Command('init')
  .description('Create a new Orkestra project')
  .argument('[name]', 'Project name')
  .option('--template <template>', 'Template to use', 'default')
  .option('--skip-install', 'Skip dependency installation')
  .action(async (name, options) => {
    console.log(chalk.bold('\n🎼 Create Orkestra Project\n'));

    // Prompt for project name if not provided
    const projectName = name ?? (await promptProjectName());

    // Prompt for configuration
    const config = await inquirer.prompt([
      {
        type: 'list',
        name: 'database',
        message: 'Database:',
        choices: [
          { name: 'PostgreSQL (recommended)', value: 'postgres' },
          { name: 'SQLite (for testing)', value: 'sqlite' },
        ],
        default: 'postgres',
      },
      {
        type: 'confirm',
        name: 'includeDashboard',
        message: 'Include dashboard?',
        default: true,
      },
      {
        type: 'checkbox',
        name: 'connectors',
        message: 'Include connectors:',
        choices: [
          { name: 'WhatsApp', value: 'whatsapp' },
          { name: 'Slack', value: 'slack' },
          { name: 'Email', value: 'email' },
        ],
      },
    ]);

    // Create project directory
    const spinner = ora('Creating project...').start();

    try {
      await copyTemplate(options.template, projectName, config);
      spinner.succeed('Project created');

      // Install dependencies
      if (!options.skipInstall) {
        spinner.start('Installing dependencies...');
        await installDependencies(projectName);
        spinner.succeed('Dependencies installed');
      }

      // Print next steps
      console.log(chalk.green('\n✅ Project created successfully!\n'));
      console.log('Next steps:');
      console.log(chalk.cyan(`  cd ${projectName}`));
      console.log(chalk.cyan('  npx orkestra dev'));
      console.log(chalk.cyan('  # Open http://localhost:8080 for Temporal UI'));
      console.log(chalk.cyan('  # Open http://localhost:3001 for Dashboard\n'));
    } catch (error) {
      spinner.fail('Failed to create project');
      console.error(error);
      process.exit(1);
    }
  });

async function promptProjectName(): Promise<string> {
  const { name } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: 'my-orkestra-app',
      validate: (input) => {
        if (!/^[a-z0-9-]+$/.test(input)) {
          return 'Project name must be lowercase alphanumeric with dashes';
        }
        return true;
      },
    },
  ]);
  return name;
}
```

### Dev Command

```typescript
// commands/dev.ts
import { Command } from 'commander';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { checkDocker, startDockerCompose } from '../utils/docker';

export const devCommand = new Command('dev')
  .description('Start development environment')
  .option('--no-docker', 'Skip Docker services')
  .option('--port <port>', 'API port', '3000')
  .action(async (options) => {
    console.log(chalk.bold('\n🎼 Starting Orkestra Development Environment\n'));

    // Check Docker
    if (!options.noDocker) {
      const dockerAvailable = await checkDocker();
      if (!dockerAvailable) {
        console.log(chalk.yellow('Docker not found. Starting without Docker services.'));
        console.log(chalk.yellow('Make sure Temporal and PostgreSQL are running.\n'));
      } else {
        console.log(chalk.dim('Starting Docker services...'));
        await startDockerCompose();
        console.log(chalk.green('✓ Docker services started'));
        console.log(chalk.dim('  - PostgreSQL: localhost:5432'));
        console.log(chalk.dim('  - Temporal: localhost:7233'));
        console.log(chalk.dim('  - Temporal UI: localhost:8080\n'));
      }
    }

    // Start Temporal worker
    console.log(chalk.dim('Starting Temporal worker...'));
    const worker = spawn('npx', ['tsx', 'src/worker.ts'], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development' },
    });

    // Start API server
    console.log(chalk.dim('Starting API server...'));
    const api = spawn('npx', ['tsx', 'watch', 'src/server.ts'], {
      stdio: 'inherit',
      env: { ...process.env, PORT: options.port },
    });

    // Start Dashboard (if present)
    if (await hasDashboard()) {
      console.log(chalk.dim('Starting Dashboard...'));
      const dashboard = spawn('pnpm', ['--filter', 'dashboard', 'dev'], {
        stdio: 'inherit',
      });
    }

    // Handle shutdown
    process.on('SIGINT', () => {
      console.log(chalk.dim('\nShutting down...'));
      worker.kill();
      api.kill();
      process.exit(0);
    });
  });
```

### Generate Command

```typescript
// commands/generate.ts
import { Command } from 'commander';
import inquirer from 'inquirer';
import { writeFile, readFile } from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export const generateCommand = new Command('generate')
  .alias('g')
  .description('Generate Orkestra components');

// Generate workflow
generateCommand
  .command('workflow <name>')
  .description('Generate a new workflow')
  .option('--with-task', 'Include human task example')
  .action(async (name, options) => {
    console.log(chalk.dim(`\nGenerating workflow: ${name}\n`));

    const template = options.withTask
      ? getWorkflowWithTaskTemplate(name)
      : getBasicWorkflowTemplate(name);

    const filePath = path.join(process.cwd(), 'src/workflows', `${name}.ts`);
    await writeFile(filePath, template);

    console.log(chalk.green(`✓ Created ${filePath}`));
    console.log(chalk.dim('\nRemember to register the workflow in src/worker.ts'));
  });

// Generate activity
generateCommand
  .command('activity <name>')
  .description('Generate a new activity')
  .action(async (name) => {
    const template = getActivityTemplate(name);
    const filePath = path.join(process.cwd(), 'src/activities', `${name}.ts`);
    await writeFile(filePath, template);

    console.log(chalk.green(`✓ Created ${filePath}`));
  });

function getWorkflowWithTaskTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  return `
import { workflow, task, timeout } from '@orkestra/sdk';

interface ${pascalName}Input {
  // Define your input type
}

interface ${pascalName}Output {
  // Define your output type
}

export const ${name} = workflow<${pascalName}Input, ${pascalName}Output>(
  '${name}',
  async (ctx, input) => {
    ctx.log.info('Workflow started', { input });

    // Create a human task
    const result = await task(ctx, {
      title: 'Task Title',
      form: {
        response: {
          type: 'textarea',
          label: 'Your response',
          required: true,
        },
      },
      assignTo: { group: 'default' },
      sla: timeout('30m'),
    });

    ctx.log.info('Task completed', { result });

    return {
      // Return your output
    };
  }
);
`.trim();
}

function getBasicWorkflowTemplate(name: string): string {
  const pascalName = toPascalCase(name);
  return `
import { workflow } from '@orkestra/sdk';
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const { /* your activities */ } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

interface ${pascalName}Input {
  // Define your input type
}

interface ${pascalName}Output {
  // Define your output type
}

export const ${name} = workflow<${pascalName}Input, ${pascalName}Output>(
  '${name}',
  async (ctx, input) => {
    ctx.log.info('Workflow started', { input });

    // Your workflow logic here

    return {
      // Return your output
    };
  }
);
`.trim();
}
```

### Database Commands

```typescript
// commands/db.ts
import { Command } from 'commander';
import { spawn } from 'child_process';

export const dbCommand = new Command('db')
  .description('Database management commands');

dbCommand
  .command('migrate')
  .description('Run database migrations')
  .action(async () => {
    spawn('npx', ['prisma', 'migrate', 'dev'], { stdio: 'inherit' });
  });

dbCommand
  .command('push')
  .description('Push schema changes to database')
  .action(async () => {
    spawn('npx', ['prisma', 'db', 'push'], { stdio: 'inherit' });
  });

dbCommand
  .command('studio')
  .description('Open Prisma Studio')
  .action(async () => {
    spawn('npx', ['prisma', 'studio'], { stdio: 'inherit' });
  });

dbCommand
  .command('seed')
  .description('Seed the database')
  .action(async () => {
    spawn('npx', ['tsx', 'prisma/seed.ts'], { stdio: 'inherit' });
  });
```

### Project Template

```
templates/project/
├── src/
│   ├── server.ts              # API entry point
│   ├── worker.ts              # Temporal worker
│   ├── workflows/
│   │   └── example.ts
│   └── activities/
│       └── index.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Acceptance Criteria

- [ ] `npx create-orkestra` scaffolds a new project
- [ ] Interactive prompts for configuration
- [ ] Templates copied correctly
- [ ] Dependencies installed
- [ ] `orkestra dev` starts all services
- [ ] Docker services managed correctly
- [ ] `orkestra generate workflow` creates files
- [ ] `orkestra generate activity` creates files
- [ ] `orkestra db` commands work
- [ ] Help text for all commands
- [ ] Error handling with helpful messages

## Dependencies

- [[01 - Initialize Monorepo]]

## Blocked By

- [[01 - Initialize Monorepo]]

## Blocks

- [[17 - Example Project]]

## Technical Notes

### Dependencies

```json
{
  "dependencies": {
    "commander": "^11.0.0",
    "inquirer": "^9.2.0",
    "chalk": "^5.3.0",
    "ora": "^7.0.0",
    "fs-extra": "^11.2.0"
  }
}
```

### Bin Configuration

```json
{
  "bin": {
    "orkestra": "./bin/orkestra.js",
    "create-orkestra": "./bin/create-orkestra.js"
  }
}
```

### bin/orkestra.js

```javascript
#!/usr/bin/env node
import('../dist/cli.js').then(({ program }) => program.parse());
```

## References

- [Commander.js](https://github.com/tj/commander.js)
- [Inquirer.js](https://github.com/SBoudrias/Inquirer.js)

## Tags

#orkestra #task #cli #developer-experience #scaffolding
