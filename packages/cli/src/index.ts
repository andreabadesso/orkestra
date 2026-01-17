/**
 * @orkestra/cli
 *
 * CLI tool for Orkestra.
 * This package provides command-line utilities for scaffolding
 * and managing Orkestra projects.
 */

export const VERSION = '0.0.1';

// Export the main program for programmatic use
export { program } from './cli.js';

// Export commands for extension
export { initCommand } from './commands/init.js';
export { devCommand } from './commands/dev.js';
export { generateCommand } from './commands/generate.js';
export { dbCommand } from './commands/db.js';

// Export utilities for extension
export * from './utils/index.js';

// Export templates for extension
export * from './templates/index.js';
