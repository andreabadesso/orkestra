/**
 * Docker utilities for CLI operations
 */

import { exec, spawn, type ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DockerService {
  name: string;
  status: 'running' | 'stopped' | 'not_found';
  ports?: string[];
}

/**
 * Check if Docker is installed and running
 */
export async function isDockerRunning(): Promise<boolean> {
  try {
    await execAsync('docker info');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if docker-compose is available
 */
export async function isDockerComposeAvailable(): Promise<boolean> {
  try {
    // Try docker compose (v2)
    await execAsync('docker compose version');
    return true;
  } catch {
    try {
      // Try docker-compose (v1)
      await execAsync('docker-compose --version');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get the docker compose command (v1 or v2)
 */
export async function getDockerComposeCommand(): Promise<string> {
  try {
    await execAsync('docker compose version');
    return 'docker compose';
  } catch {
    return 'docker-compose';
  }
}

/**
 * Get status of docker-compose services
 */
export async function getServiceStatus(projectDir: string): Promise<DockerService[]> {
  try {
    const composeCmd = await getDockerComposeCommand();
    const { stdout } = await execAsync(`${composeCmd} ps --format json`, {
      cwd: projectDir,
    });

    if (!stdout.trim()) {
      return [];
    }

    // Parse JSON output (each line is a JSON object)
    const services: DockerService[] = [];
    for (const line of stdout.trim().split('\n')) {
      try {
        const service = JSON.parse(line);
        services.push({
          name: service.Name || service.Service,
          status: service.State === 'running' ? 'running' : 'stopped',
          ports: service.Ports ? [service.Ports] : [],
        });
      } catch {
        // Skip invalid JSON lines
      }
    }

    return services;
  } catch {
    return [];
  }
}

/**
 * Start docker-compose services
 */
export async function startServices(projectDir: string): Promise<void> {
  const composeCmd = await getDockerComposeCommand();
  await execAsync(`${composeCmd} up -d`, { cwd: projectDir });
}

/**
 * Stop docker-compose services
 */
export async function stopServices(projectDir: string): Promise<void> {
  const composeCmd = await getDockerComposeCommand();
  await execAsync(`${composeCmd} down`, { cwd: projectDir });
}

/**
 * Spawn a process with inherited stdio
 */
export function spawnProcess(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): ChildProcess {
  return spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
    shell: true,
  });
}

/**
 * Wait for a port to be available
 */
export async function waitForPort(
  port: number,
  host: string = 'localhost',
  timeout: number = 30000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await execAsync(`nc -z ${host} ${port}`);
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return false;
}
