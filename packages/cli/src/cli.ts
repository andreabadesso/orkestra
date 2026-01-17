/**
 * @orkestra/cli
 *
 * Main CLI program with all commands.
 */

import { Command } from 'commander';
import chalk from 'chalk';

import { VERSION } from './index.js';
import { initCommand, devCommand, generateCommand, dbCommand, workflowAgentCommand } from './commands/index.js';

// ASCII art logo
const logo = chalk.cyan(`
   ___       _              _
  / _ \\ _ __| | _____  ___| |_ _ __ __ _
 | | | | '__| |/ / _ \\/ __| __| '__/ _\` |
 | |_| | |  |   <  __/\\__ \\ |_| | | (_| |
  \\___/|_|  |_|\\_\\___||___/\\__|_|  \\__,_|
`);

/**
 * Main CLI program
 */
export const program = new Command()
  .name('orkestra')
  .description('CLI tool for Orkestra - AI-native BPM orchestration')
  .version(VERSION, '-v, --version', 'Output the current version')
  .addHelpText('beforeAll', logo)
  .addCommand(initCommand)
  .addCommand(devCommand)
  .addCommand(generateCommand)
  .addCommand(dbCommand)
  .addCommand(workflowAgentCommand);

// Add helpful examples to help text
program.addHelpText(
  'after',
  `
Examples:
  ${chalk.dim('# Create a new project')}
  $ orkestra init my-app

  ${chalk.dim('# Start development environment')}
  $ orkestra dev

  ${chalk.dim('# Generate a new workflow')}
  $ orkestra generate workflow customer-support

  ${chalk.dim('# Generate a workflow with human task')}
  $ orkestra generate workflow approval --with-task

  ${chalk.dim('# Run database migrations')}
  $ orkestra db migrate --dev

  ${chalk.dim('# Open database viewer')}
  $ orkestra db studio

  ${chalk.dim('# AI-powered workflow builder')}
  $ orkestra workflow "Create an expense approval workflow"

Learn more: https://github.com/orkestra/orkestra
`
);
