#!/usr/bin/env node

import('../dist/standalone.js').then(({ main }) => {
  main().catch((err) => {
    console.error('Failed to start MCP server:', err.message);
    process.exit(1);
  });
});
