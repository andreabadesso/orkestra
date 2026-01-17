/**
 * DB Command
 *
 * Database management commands wrapping Prisma CLI.
 */

import { Command } from 'commander';
import path from 'path';
import ora from 'ora';

import { findProjectRoot, fileExists } from '../utils/fs.js';
import { spawnProcess } from '../utils/docker.js';
import { error, info, success } from '../utils/prompts.js';

/**
 * Check if Prisma is available in the project
 */
async function checkPrisma(projectRoot: string): Promise<boolean> {
  const schemaPath = path.join(projectRoot, 'prisma', 'schema.prisma');
  return fileExists(schemaPath);
}

/**
 * Run a Prisma command
 */
async function runPrismaCommand(
  projectRoot: string,
  command: string,
  args: string[] = []
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawnProcess('npx', ['prisma', command, ...args], {
      cwd: projectRoot,
    });

    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Prisma ${command} exited with code ${code}`));
      }
    });
  });
}

/**
 * Migrate subcommand
 */
const migrateCommand = new Command('migrate')
  .description('Run database migrations')
  .option('--name <name>', 'Migration name')
  .option('--dev', 'Run in development mode (create and apply migration)')
  .action(async (options: { name?: string; dev?: boolean }) => {
    const projectRoot = await findProjectRoot();

    if (!projectRoot) {
      error('Not in an Orkestra project directory.');
      process.exit(1);
    }

    if (!(await checkPrisma(projectRoot))) {
      error('No Prisma schema found (prisma/schema.prisma).');
      info('Initialize Prisma with: npx prisma init');
      process.exit(1);
    }

    const spinner = ora('Running migrations...').start();

    try {
      if (options.dev) {
        // Development migration (create and apply)
        const args = ['dev'];
        if (options.name) {
          args.push('--name', options.name);
        }
        spinner.stop();
        await runPrismaCommand(projectRoot, 'migrate', args);
        success('Migration completed successfully!');
      } else {
        // Production migration (apply only)
        spinner.stop();
        await runPrismaCommand(projectRoot, 'migrate', ['deploy']);
        success('Migrations deployed successfully!');
      }
    } catch (err) {
      spinner.fail('Migration failed');
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

/**
 * Push subcommand
 */
const pushCommand = new Command('push')
  .description('Push schema changes to database (without migration files)')
  .option('--force-reset', 'Reset the database before pushing')
  .action(async (options: { forceReset?: boolean }) => {
    const projectRoot = await findProjectRoot();

    if (!projectRoot) {
      error('Not in an Orkestra project directory.');
      process.exit(1);
    }

    if (!(await checkPrisma(projectRoot))) {
      error('No Prisma schema found (prisma/schema.prisma).');
      info('Initialize Prisma with: npx prisma init');
      process.exit(1);
    }

    const spinner = ora('Pushing schema changes...').start();

    try {
      const args = [];
      if (options.forceReset) {
        args.push('--force-reset');
      }

      spinner.stop();
      await runPrismaCommand(projectRoot, 'db', ['push', ...args]);
      success('Schema pushed successfully!');
    } catch (err) {
      spinner.fail('Push failed');
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

/**
 * Studio subcommand
 */
const studioCommand = new Command('studio')
  .description('Open Prisma Studio database viewer')
  .option('--port <port>', 'Port for Prisma Studio', '5555')
  .action(async (options: { port?: string }) => {
    const projectRoot = await findProjectRoot();

    if (!projectRoot) {
      error('Not in an Orkestra project directory.');
      process.exit(1);
    }

    if (!(await checkPrisma(projectRoot))) {
      error('No Prisma schema found (prisma/schema.prisma).');
      info('Initialize Prisma with: npx prisma init');
      process.exit(1);
    }

    info(`Starting Prisma Studio on port ${options.port}...`);
    console.log();

    try {
      await runPrismaCommand(projectRoot, 'studio', ['--port', options.port || '5555']);
    } catch (err) {
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

/**
 * Seed subcommand
 */
const seedCommand = new Command('seed')
  .description('Run database seed script')
  .action(async () => {
    const projectRoot = await findProjectRoot();

    if (!projectRoot) {
      error('Not in an Orkestra project directory.');
      process.exit(1);
    }

    if (!(await checkPrisma(projectRoot))) {
      error('No Prisma schema found (prisma/schema.prisma).');
      info('Initialize Prisma with: npx prisma init');
      process.exit(1);
    }

    // Check for seed file
    const seedPath = path.join(projectRoot, 'prisma', 'seed.ts');
    const seedJsPath = path.join(projectRoot, 'prisma', 'seed.js');

    if (!(await fileExists(seedPath)) && !(await fileExists(seedJsPath))) {
      error('No seed file found (prisma/seed.ts or prisma/seed.js).');
      info('Create a seed file to populate your database with initial data.');
      process.exit(1);
    }

    const spinner = ora('Running seed script...').start();

    try {
      spinner.stop();
      await runPrismaCommand(projectRoot, 'db', ['seed']);
      success('Database seeded successfully!');
    } catch (err) {
      spinner.fail('Seed failed');
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

/**
 * Generate subcommand (Prisma Client)
 */
const generateClientCommand = new Command('generate')
  .description('Generate Prisma Client')
  .action(async () => {
    const projectRoot = await findProjectRoot();

    if (!projectRoot) {
      error('Not in an Orkestra project directory.');
      process.exit(1);
    }

    if (!(await checkPrisma(projectRoot))) {
      error('No Prisma schema found (prisma/schema.prisma).');
      info('Initialize Prisma with: npx prisma init');
      process.exit(1);
    }

    const spinner = ora('Generating Prisma Client...').start();

    try {
      spinner.stop();
      await runPrismaCommand(projectRoot, 'generate', []);
      success('Prisma Client generated successfully!');
    } catch (err) {
      spinner.fail('Generation failed');
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

/**
 * Main db command
 */
export const dbCommand = new Command('db')
  .description('Database management commands')
  .addCommand(migrateCommand)
  .addCommand(pushCommand)
  .addCommand(studioCommand)
  .addCommand(seedCommand)
  .addCommand(generateClientCommand);
