/**
 * Init Command
 *
 * Initialize a new Orkestra project with interactive prompts.
 */

import { Command } from 'commander';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';

import {
  directoryExists,
  ensureDir,
  writeFile,
} from '../utils/fs.js';
import {
  promptProjectConfig,
  confirm,
  success,
  error,
  info,
  header,
} from '../utils/prompts.js';
import {
  generatePackageJsonTemplate,
  generateDockerComposeTemplate,
  generateTsConfigTemplate,
  generateEnvExampleTemplate,
  generateWorkflowTemplate,
  generateActivityTemplate,
} from '../templates/workflow.js';

export const initCommand = new Command('init')
  .description('Initialize a new Orkestra project')
  .argument('[name]', 'Project name')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .option('--database <type>', 'Database type (postgres or sqlite)', 'postgres')
  .option('--no-dashboard', 'Skip dashboard setup')
  .option('--no-examples', 'Skip example workflows')
  .action(async (name?: string, options?: {
    yes?: boolean;
    database?: 'postgres' | 'sqlite';
    dashboard?: boolean;
    examples?: boolean;
  }) => {
    header('Orkestra Project Setup');

    let config;

    if (options?.yes) {
      // Use defaults
      config = {
        name: name || 'my-orkestra-app',
        database: (options.database as 'postgres' | 'sqlite') || 'postgres',
        includeDashboard: options.dashboard !== false,
        includeExamples: options.examples !== false,
      };
    } else {
      // Interactive prompts
      config = await promptProjectConfig(name);
    }

    const projectDir = path.resolve(process.cwd(), config.name);

    // Check if directory already exists
    if (await directoryExists(projectDir)) {
      const overwrite = await confirm(
        `Directory ${config.name} already exists. Overwrite?`,
        false
      );
      if (!overwrite) {
        info('Aborted. No changes made.');
        return;
      }
    }

    const spinner = ora('Creating project structure...').start();

    try {
      // Create project directory
      await ensureDir(projectDir);

      // Create subdirectories
      await ensureDir(path.join(projectDir, 'src', 'workflows'));
      await ensureDir(path.join(projectDir, 'src', 'activities'));
      await ensureDir(path.join(projectDir, 'src', 'config'));

      // Generate package.json
      spinner.text = 'Generating package.json...';
      await writeFile(
        path.join(projectDir, 'package.json'),
        generatePackageJsonTemplate(config.name, {
          database: config.database,
          includeDashboard: config.includeDashboard,
        })
      );

      // Generate tsconfig.json
      spinner.text = 'Generating tsconfig.json...';
      await writeFile(
        path.join(projectDir, 'tsconfig.json'),
        generateTsConfigTemplate()
      );

      // Generate docker-compose.yml
      spinner.text = 'Generating docker-compose.yml...';
      await writeFile(
        path.join(projectDir, 'docker-compose.yml'),
        generateDockerComposeTemplate({ database: config.database })
      );

      // Generate .env.example
      spinner.text = 'Generating .env.example...';
      await writeFile(
        path.join(projectDir, '.env.example'),
        generateEnvExampleTemplate({ database: config.database })
      );

      // Generate .env (copy of example)
      await writeFile(
        path.join(projectDir, '.env'),
        generateEnvExampleTemplate({ database: config.database })
      );

      // Generate .gitignore
      spinner.text = 'Generating .gitignore...';
      await writeFile(
        path.join(projectDir, '.gitignore'),
        `# Dependencies
node_modules/

# Build output
dist/

# Environment files
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Database (SQLite)
*.db
*.db-journal

# Temporal
.temporal/
`
      );

      // Generate example files if requested
      if (config.includeExamples) {
        spinner.text = 'Generating example workflows...';

        // Example workflow
        await writeFile(
          path.join(projectDir, 'src', 'workflows', 'example.ts'),
          generateWorkflowTemplate('example')
        );

        // Example activity
        await writeFile(
          path.join(projectDir, 'src', 'activities', 'example.ts'),
          generateActivityTemplate('example')
        );

        // Activities index
        await writeFile(
          path.join(projectDir, 'src', 'activities', 'index.ts'),
          `/**
 * Activities Index
 *
 * Export all activities from this file.
 */

export * from './example.js';
`
        );

        // Workflows index
        await writeFile(
          path.join(projectDir, 'src', 'workflows', 'index.ts'),
          `/**
 * Workflows Index
 *
 * Export all workflows from this file.
 */

export * from './example.js';
`
        );
      }

      // Generate worker entry point
      spinner.text = 'Generating worker entry point...';
      await writeFile(
        path.join(projectDir, 'src', 'worker.ts'),
        `/**
 * Temporal Worker
 *
 * This file sets up and starts the Temporal worker.
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities/index.js';

async function run() {
  // Connect to Temporal server
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  // Create worker
  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: '${config.name}',
    workflowsPath: new URL('./workflows/index.js', import.meta.url).pathname,
    activities,
  });

  console.log('Worker started successfully');

  // Run the worker
  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
`
      );

      spinner.succeed('Project created successfully!');

      // Print next steps
      console.log();
      console.log(chalk.bold('Next steps:'));
      console.log();
      console.log(`  ${chalk.cyan('cd')} ${config.name}`);
      console.log(`  ${chalk.cyan('pnpm install')}`);
      console.log(`  ${chalk.cyan('docker-compose up -d')}`);
      console.log(`  ${chalk.cyan('pnpm dev')}`);
      console.log();

      if (config.database === 'postgres') {
        info('PostgreSQL will be available at localhost:5432');
      }
      info('Temporal UI will be available at http://localhost:8080');
      console.log();

      success(`Project ${config.name} is ready!`);
    } catch (err) {
      spinner.fail('Failed to create project');
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });
