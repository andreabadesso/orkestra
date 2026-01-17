#!/usr/bin/env node

/**
 * Create Orkestra CLI Entry Point
 *
 * This is the entry point for `npm create orkestra` / `npx create-orkestra`.
 * It runs the init command directly with any provided arguments.
 */

import('../dist/cli.js').then(({ program }) => {
  // Find the init command and execute it with remaining args
  const initCmd = program.commands.find((cmd) => cmd.name() === 'init');

  if (initCmd) {
    // Parse with init as the default command
    const args = ['init', ...process.argv.slice(2)];
    program.parse(args, { from: 'user' });
  } else {
    console.error('Init command not found');
    process.exit(1);
  }
}).catch((err) => {
  console.error('Failed to load CLI:', err.message);
  process.exit(1);
});
