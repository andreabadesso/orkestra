/**
 * Dev Command
 *
 * Start development environment with Docker services, Temporal worker, and API server.
 */

import { Command } from 'commander';
import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { type ChildProcess } from 'child_process';

import { findProjectRoot, fileExists } from '../utils/fs.js';
import {
  isDockerRunning,
  isDockerComposeAvailable,
  getServiceStatus,
  startServices,
  spawnProcess,
} from '../utils/docker.js';
import { error, info, success, warning, header } from '../utils/prompts.js';

// Track child processes for cleanup
const childProcesses: ChildProcess[] = [];

/**
 * Cleanup function for graceful shutdown
 */
function cleanup(): void {
  info('Shutting down...');

  for (const proc of childProcesses) {
    if (proc && !proc.killed) {
      proc.kill('SIGTERM');
    }
  }

  process.exit(0);
}

export const devCommand = new Command('dev')
  .description('Start development environment')
  .option('--no-docker', 'Skip Docker services')
  .option('--no-worker', 'Skip Temporal worker')
  .option('--no-api', 'Skip API server')
  .option('--port <port>', 'API server port', '3000')
  .action(async (options: {
    docker?: boolean;
    worker?: boolean;
    api?: boolean;
    port?: string;
  }) => {
    header('Orkestra Development Server');

    // Find project root
    const projectRoot = await findProjectRoot();

    if (!projectRoot) {
      error('Not in an Orkestra project directory.');
      info('Run this command from within an Orkestra project, or use "orkestra init" to create one.');
      process.exit(1);
    }

    info(`Project root: ${projectRoot}`);
    console.log();

    // Set up signal handlers for graceful shutdown
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Step 1: Check and start Docker services
    if (options.docker !== false) {
      const spinner = ora('Checking Docker...').start();

      // Check if Docker is running
      if (!(await isDockerRunning())) {
        spinner.fail('Docker is not running');
        error('Please start Docker and try again.');
        process.exit(1);
      }

      // Check if docker-compose is available
      if (!(await isDockerComposeAvailable())) {
        spinner.fail('Docker Compose is not installed');
        error('Please install Docker Compose and try again.');
        process.exit(1);
      }

      // Check for docker-compose.yml
      const composeFile = path.join(projectRoot, 'docker-compose.yml');
      if (!(await fileExists(composeFile))) {
        spinner.warn('No docker-compose.yml found');
        warning('Skipping Docker services. Create a docker-compose.yml file to enable this feature.');
      } else {
        // Check service status
        spinner.text = 'Checking service status...';
        const services = await getServiceStatus(projectRoot);
        const runningServices = services.filter((s) => s.status === 'running');

        if (runningServices.length > 0) {
          spinner.succeed(`Docker services already running: ${runningServices.map((s) => s.name).join(', ')}`);
        } else {
          // Start services
          spinner.text = 'Starting Docker services...';
          try {
            await startServices(projectRoot);
            spinner.succeed('Docker services started');

            // Wait a bit for services to initialize
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } catch (err) {
            spinner.fail('Failed to start Docker services');
            error(err instanceof Error ? err.message : String(err));
            process.exit(1);
          }
        }
      }
    } else {
      info('Skipping Docker services (--no-docker)');
    }

    // Step 2: Start Temporal worker
    if (options.worker !== false) {
      const workerPath = path.join(projectRoot, 'src', 'worker.ts');
      const workerDistPath = path.join(projectRoot, 'dist', 'worker.js');

      // Check if worker file exists
      const hasWorkerSrc = await fileExists(workerPath);
      const hasWorkerDist = await fileExists(workerDistPath);

      if (!hasWorkerSrc && !hasWorkerDist) {
        warning('No worker file found (src/worker.ts or dist/worker.js)');
        info('Skipping Temporal worker. Create src/worker.ts to enable this feature.');
      } else {
        info('Starting Temporal worker...');

        // Use tsx for development (TypeScript execution)
        const workerProc = spawnProcess('npx', ['tsx', 'watch', 'src/worker.ts'], {
          cwd: projectRoot,
          env: {
            NODE_ENV: 'development',
          },
        });

        childProcesses.push(workerProc);

        workerProc.on('error', (err) => {
          error(`Worker error: ${err.message}`);
        });

        workerProc.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            warning(`Worker exited with code ${code}`);
          }
        });
      }
    } else {
      info('Skipping Temporal worker (--no-worker)');
    }

    // Step 3: Start API server (placeholder)
    if (options.api !== false) {
      const apiPath = path.join(projectRoot, 'src', 'api.ts');
      const apiDistPath = path.join(projectRoot, 'dist', 'api.js');

      // Check if API file exists
      const hasApiSrc = await fileExists(apiPath);
      const hasApiDist = await fileExists(apiDistPath);

      if (!hasApiSrc && !hasApiDist) {
        info('No API server file found (src/api.ts)');
        info('Skipping API server. Create src/api.ts to enable this feature.');
      } else {
        info(`Starting API server on port ${options.port}...`);

        const apiProc = spawnProcess('npx', ['tsx', 'watch', 'src/api.ts'], {
          cwd: projectRoot,
          env: {
            NODE_ENV: 'development',
            PORT: options.port,
          },
        });

        childProcesses.push(apiProc);

        apiProc.on('error', (err) => {
          error(`API error: ${err.message}`);
        });

        apiProc.on('exit', (code) => {
          if (code !== 0 && code !== null) {
            warning(`API server exited with code ${code}`);
          }
        });
      }
    } else {
      info('Skipping API server (--no-api)');
    }

    // Print running status
    console.log();
    success('Development environment started!');
    console.log();
    console.log(chalk.dim('Press Ctrl+C to stop all services'));
    console.log();

    // Keep the process running
    await new Promise(() => {});
  });
