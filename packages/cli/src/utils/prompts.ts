/**
 * Reusable prompt utilities for CLI commands
 */

import inquirer from 'inquirer';
import chalk from 'chalk';

export interface ProjectConfig {
  name: string;
  database: 'postgres' | 'sqlite';
  includeDashboard: boolean;
  includeExamples: boolean;
}

/**
 * Prompt for project initialization configuration
 */
export async function promptProjectConfig(defaultName?: string): Promise<ProjectConfig> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: defaultName || 'my-orkestra-app',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Project name is required';
        }
        if (!/^[a-z0-9-_]+$/i.test(input)) {
          return 'Project name can only contain letters, numbers, hyphens, and underscores';
        }
        return true;
      },
    },
    {
      type: 'list',
      name: 'database',
      message: 'Which database would you like to use?',
      choices: [
        { name: 'PostgreSQL (recommended for production)', value: 'postgres' },
        { name: 'SQLite (simpler, good for development)', value: 'sqlite' },
      ],
      default: 'postgres',
    },
    {
      type: 'confirm',
      name: 'includeDashboard',
      message: 'Include the human task dashboard?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'includeExamples',
      message: 'Include example workflows?',
      default: true,
    },
  ]);

  return answers as ProjectConfig;
}

/**
 * Prompt for confirmation
 */
export async function confirm(message: string, defaultValue: boolean = true): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue,
    },
  ]);
  return confirmed;
}

/**
 * Prompt for text input
 */
export async function promptText(
  message: string,
  options: { default?: string; validate?: (input: string) => boolean | string } = {}
): Promise<string> {
  const { value } = await inquirer.prompt([
    {
      type: 'input',
      name: 'value',
      message,
      default: options.default,
      validate: options.validate,
    },
  ]);
  return value;
}

/**
 * Prompt for selection from list
 */
export async function promptSelect<T extends string>(
  message: string,
  choices: { name: string; value: T }[]
): Promise<T> {
  const { value } = await inquirer.prompt([
    {
      type: 'list',
      name: 'value',
      message,
      choices,
    },
  ]);
  return value;
}

/**
 * Display a success message
 */
export function success(message: string): void {
  console.log(chalk.green('✓'), message);
}

/**
 * Display an error message
 */
export function error(message: string): void {
  console.log(chalk.red('✗'), message);
}

/**
 * Display a warning message
 */
export function warning(message: string): void {
  console.log(chalk.yellow('!'), message);
}

/**
 * Display an info message
 */
export function info(message: string): void {
  console.log(chalk.blue('i'), message);
}

/**
 * Display a header
 */
export function header(title: string): void {
  console.log();
  console.log(chalk.bold.cyan(title));
  console.log(chalk.cyan('─'.repeat(title.length)));
}
