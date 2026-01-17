#!/usr/bin/env node

/**
 * Orkestra CLI Entry Point
 *
 * This is the main entry point for the `orkestra` command.
 */

import('../dist/cli.js').then(({ program }) => {
  program.parse();
}).catch((err) => {
  console.error('Failed to load CLI:', err.message);
  process.exit(1);
});
