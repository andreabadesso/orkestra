/**
 * Workflow Agent Command
 *
 * AI-powered workflow builder using Claude.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';

import { runAgent, initToolContext } from '../agent/index.js';
import { error, info } from '../utils/prompts.js';

export const workflowAgentCommand = new Command('workflow')
  .description('AI-powered workflow builder')
  .argument('[prompt]', 'Initial prompt to start the conversation')
  .option('-v, --verbose', 'Show verbose output including tool inputs')
  .option('--model <model>', 'Claude model to use', 'claude-sonnet-4-20250514')
  .option('--max-tokens <tokens>', 'Maximum tokens for response', '4096')
  .option('--project <path>', 'Path to the project (default: current directory)')
  .action(async (
    prompt?: string,
    options?: {
      verbose?: boolean;
      model?: string;
      maxTokens?: string;
      project?: string;
    }
  ) => {
    // Determine project path
    const projectPath = options?.project
      ? path.resolve(options.project)
      : process.cwd();

    // Initialize tool context
    const context = await initToolContext(projectPath);

    if (!context) {
      error('Could not find an Orkestra project.');
      info('Make sure you are in a directory with:');
      info('  - A package.json with @orkestra/sdk or @orkestra/core dependency, OR');
      info('  - A src/workflows directory');
      console.log();
      info('You can initialize a new project with: orkestra init');
      process.exit(1);
    }

    // Check for API key
    if (!process.env['ANTHROPIC_API_KEY']) {
      console.log();
      console.log(chalk.yellow('ANTHROPIC_API_KEY environment variable is not set.'));
      console.log();
      console.log('To use the workflow agent, you need an Anthropic API key.');
      console.log('Get one at: https://console.anthropic.com/');
      console.log();
      console.log('Set it with:');
      console.log(chalk.cyan('  export ANTHROPIC_API_KEY=your-api-key'));
      console.log();
      process.exit(1);
    }

    // Run the agent
    try {
      await runAgent(context, prompt, {
        verbose: options?.verbose ?? false,
        model: options?.model ?? 'claude-sonnet-4-20250514',
        maxTokens: options?.maxTokens ? parseInt(options.maxTokens, 10) : 4096,
      });
    } catch (err) {
      error(`Agent error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// Add helpful examples to help text
workflowAgentCommand.addHelpText(
  'after',
  `
Examples:
  ${chalk.dim('# Start interactive workflow builder')}
  $ orkestra workflow

  ${chalk.dim('# Start with an initial prompt')}
  $ orkestra workflow "Create an expense approval workflow"

  ${chalk.dim('# Use verbose mode to see tool inputs')}
  $ orkestra workflow -v

  ${chalk.dim('# Specify project directory')}
  $ orkestra workflow --project /path/to/project

The agent can help you:
  - Create new workflows with human tasks
  - Set up escalation chains
  - Understand SDK patterns
  - Analyze existing workflows
`
);
