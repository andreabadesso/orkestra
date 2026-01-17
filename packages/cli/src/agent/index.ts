/**
 * Workflow Authoring Agent
 *
 * AI-powered assistant for creating Orkestra workflows.
 */

import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';

import { SYSTEM_PROMPT, generateContextPrompt } from './prompts.js';
import { TOOL_DEFINITIONS, executeTool, initToolContext, type ToolContext, type ToolResult } from './tools.js';

// Re-export for command use
export { initToolContext };
export type { ToolContext };

/**
 * Message type for conversation history
 */
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  verbose?: boolean;
}

/**
 * Create and run the workflow authoring agent
 */
export async function runAgent(
  context: ToolContext,
  initialPrompt?: string,
  config: AgentConfig = {}
): Promise<void> {
  const {
    apiKey = process.env['ANTHROPIC_API_KEY'],
    model = 'claude-sonnet-4-20250514',
    maxTokens = 4096,
    verbose = false,
  } = config;

  if (!apiKey) {
    console.log(chalk.red('Error: ANTHROPIC_API_KEY environment variable is required'));
    console.log(chalk.dim('Set it with: export ANTHROPIC_API_KEY=your-api-key'));
    process.exit(1);
  }

  // Initialize Anthropic client
  const client = new Anthropic({ apiKey });

  // Get project context
  const spinner = ora('Analyzing project...').start();
  const projectAnalysis = await executeTool('analyze_project', {}, context);
  spinner.stop();

  const existingWorkflows = projectAnalysis.success && projectAnalysis.data
    ? (projectAnalysis.data as { workflows: Array<{ name: string }> }).workflows.map(w => w.name)
    : [];

  // Build system prompt with context
  const systemPrompt = SYSTEM_PROMPT + generateContextPrompt(existingWorkflows, context.projectRoot);

  // Conversation history
  const history: Message[] = [];

  // Print welcome
  console.log();
  console.log(chalk.cyan.bold('Orkestra Workflow Agent'));
  console.log(chalk.dim('AI-powered workflow builder'));
  console.log();

  if (existingWorkflows.length > 0) {
    console.log(chalk.dim(`Found ${existingWorkflows.length} existing workflow(s): ${existingWorkflows.join(', ')}`));
    console.log();
  }

  console.log(chalk.dim('Type your request or "exit" to quit.'));
  console.log(chalk.dim('Examples: "Create a document approval workflow" or "Help me understand escalation patterns"'));
  console.log();

  // Handle initial prompt if provided
  if (initialPrompt) {
    console.log(chalk.green('You:'), initialPrompt);
    console.log();
    await processUserMessage(initialPrompt, client, systemPrompt, history, context, { model, maxTokens, verbose });
  }

  // Interactive loop
  while (true) {
    const { userInput } = await inquirer.prompt([
      {
        type: 'input',
        name: 'userInput',
        message: chalk.green('You:'),
        prefix: '',
      },
    ]);

    const trimmedInput = userInput.trim();

    if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
      console.log(chalk.dim('Goodbye!'));
      break;
    }

    if (!trimmedInput) {
      continue;
    }

    await processUserMessage(trimmedInput, client, systemPrompt, history, context, { model, maxTokens, verbose });
  }
}

/**
 * Process a user message and get agent response
 */
async function processUserMessage(
  userMessage: string,
  client: Anthropic,
  systemPrompt: string,
  history: Message[],
  context: ToolContext,
  config: { model: string; maxTokens: number; verbose: boolean }
): Promise<void> {
  const { model, maxTokens, verbose } = config;

  // Add user message to history
  history.push({ role: 'user', content: userMessage });

  // Build messages for API
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const spinner = ora('Thinking...').start();

  try {
    // Call Claude API with tools
    let response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: TOOL_DEFINITIONS,
      messages,
    });

    spinner.stop();

    // Process response - handle tool calls in a loop
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      // Process all tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        if (verbose) {
          console.log(chalk.dim(`\nTool: ${toolUse.name}`));
          console.log(chalk.dim(`Input: ${JSON.stringify(toolUse.input, null, 2)}`));
        }

        const toolSpinner = ora(`Running ${toolUse.name}...`).start();

        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          context
        );

        toolSpinner.stop();

        if (result.success) {
          console.log(chalk.green('  ' + result.message));
        } else {
          console.log(chalk.yellow('  ' + result.message));
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Add assistant message with tool use and tool results to history
      messages.push({
        role: 'assistant',
        content: response.content,
      });

      messages.push({
        role: 'user',
        content: toolResults,
      });

      // Get next response
      const continueSpinner = ora('Processing...').start();

      response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        tools: TOOL_DEFINITIONS,
        messages,
      });

      continueSpinner.stop();
    }

    // Extract and display text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    const assistantMessage = textBlocks.map((b) => b.text).join('\n');

    if (assistantMessage) {
      console.log();
      console.log(chalk.cyan('Agent:'), assistantMessage);
      console.log();

      // Add to history
      history.push({ role: 'assistant', content: assistantMessage });
    }

    // Update history with final assistant response
    // (We need to sync the messages with history for the next iteration)
    // The history is simplified - we just track user/assistant text for display
    // The full messages array with tool calls is rebuilt each time
  } catch (error) {
    spinner.stop();

    if (error instanceof Anthropic.APIError) {
      console.log(chalk.red(`API Error: ${error.message}`));

      if (error.status === 401) {
        console.log(chalk.dim('Check your ANTHROPIC_API_KEY'));
      } else if (error.status === 429) {
        console.log(chalk.dim('Rate limited. Please wait and try again.'));
      }
    } else {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    }

    // Remove the failed user message from history
    history.pop();
  }
}

/**
 * Single-shot agent call (non-interactive)
 */
export async function callAgent(
  context: ToolContext,
  prompt: string,
  config: AgentConfig = {}
): Promise<{ response: string; toolResults: ToolResult[] }> {
  const {
    apiKey = process.env['ANTHROPIC_API_KEY'],
    model = 'claude-sonnet-4-20250514',
    maxTokens = 4096,
  } = config;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const client = new Anthropic({ apiKey });

  // Get project context
  const projectAnalysis = await executeTool('analyze_project', {}, context);
  const existingWorkflows = projectAnalysis.success && projectAnalysis.data
    ? (projectAnalysis.data as { workflows: Array<{ name: string }> }).workflows.map(w => w.name)
    : [];

  const systemPrompt = SYSTEM_PROMPT + generateContextPrompt(existingWorkflows, context.projectRoot);

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: prompt },
  ];

  const toolResults: ToolResult[] = [];

  let response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    tools: TOOL_DEFINITIONS,
    messages,
  });

  // Process tool calls
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    const results: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(
        toolUse.name,
        toolUse.input as Record<string, unknown>,
        context
      );

      toolResults.push(result);

      results.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({
      role: 'assistant',
      content: response.content,
    });

    messages.push({
      role: 'user',
      content: results,
    });

    response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: TOOL_DEFINITIONS,
      messages,
    });
  }

  const textBlocks = response.content.filter(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );

  return {
    response: textBlocks.map((b) => b.text).join('\n'),
    toolResults,
  };
}
