/**
 * Generate Command
 *
 * Generate workflow and activity files from templates.
 */

import { Command } from 'commander';
import path from 'path';
import ora from 'ora';

import {
  findProjectRoot,
  fileExists,
  writeFile,
  toKebabCase,
} from '../utils/fs.js';
import { confirm, error, info } from '../utils/prompts.js';
import {
  generateWorkflowTemplate,
  generateWorkflowWithTaskTemplate,
  generateActivityTemplate,
  generateActivityWithTaskTemplate,
} from '../templates/workflow.js';

/**
 * Generate workflow subcommand
 */
const workflowCommand = new Command('workflow')
  .description('Generate a new workflow file')
  .argument('<name>', 'Workflow name')
  .option('--with-task', 'Include human task example')
  .option('-f, --force', 'Overwrite existing file')
  .action(async (name: string, options: { withTask?: boolean; force?: boolean }) => {
    const projectRoot = await findProjectRoot();

    if (!projectRoot) {
      error('Not in an Orkestra project directory.');
      info('Run this command from within an Orkestra project, or use "orkestra init" to create one.');
      process.exit(1);
    }

    const kebabName = toKebabCase(name);
    const workflowPath = path.join(projectRoot, 'src', 'workflows', `${kebabName}.ts`);

    // Check if file already exists
    if (await fileExists(workflowPath)) {
      if (!options.force) {
        const overwrite = await confirm(
          `Workflow file ${kebabName}.ts already exists. Overwrite?`,
          false
        );
        if (!overwrite) {
          info('Aborted. No changes made.');
          return;
        }
      }
    }

    const spinner = ora(`Generating workflow ${kebabName}...`).start();

    try {
      // Generate template
      const template = options.withTask
        ? generateWorkflowWithTaskTemplate(kebabName)
        : generateWorkflowTemplate(kebabName);

      // Write file
      await writeFile(workflowPath, template);

      spinner.succeed(`Workflow generated: src/workflows/${kebabName}.ts`);

      // Remind to export
      console.log();
      info('Remember to export your workflow from src/workflows/index.ts:');
      console.log();
      console.log(`  export * from './${kebabName}.js';`);
      console.log();
    } catch (err) {
      spinner.fail('Failed to generate workflow');
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

/**
 * Generate activity subcommand
 */
const activityCommand = new Command('activity')
  .description('Generate a new activity file')
  .argument('<name>', 'Activity name')
  .option('--with-task', 'Include human task helpers')
  .option('-f, --force', 'Overwrite existing file')
  .action(async (name: string, options: { withTask?: boolean; force?: boolean }) => {
    const projectRoot = await findProjectRoot();

    if (!projectRoot) {
      error('Not in an Orkestra project directory.');
      info('Run this command from within an Orkestra project, or use "orkestra init" to create one.');
      process.exit(1);
    }

    const kebabName = toKebabCase(name);
    const activityPath = path.join(projectRoot, 'src', 'activities', `${kebabName}.ts`);

    // Check if file already exists
    if (await fileExists(activityPath)) {
      if (!options.force) {
        const overwrite = await confirm(
          `Activity file ${kebabName}.ts already exists. Overwrite?`,
          false
        );
        if (!overwrite) {
          info('Aborted. No changes made.');
          return;
        }
      }
    }

    const spinner = ora(`Generating activity ${kebabName}...`).start();

    try {
      // Generate template
      const template = options.withTask
        ? generateActivityWithTaskTemplate(kebabName)
        : generateActivityTemplate(kebabName);

      // Write file
      await writeFile(activityPath, template);

      spinner.succeed(`Activity generated: src/activities/${kebabName}.ts`);

      // Remind to export
      console.log();
      info('Remember to export your activity from src/activities/index.ts:');
      console.log();
      console.log(`  export * from './${kebabName}.js';`);
      console.log();
    } catch (err) {
      spinner.fail('Failed to generate activity');
      error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

/**
 * Main generate command
 */
export const generateCommand = new Command('generate')
  .alias('g')
  .description('Generate workflow or activity files')
  .addCommand(workflowCommand)
  .addCommand(activityCommand);
