#!/usr/bin/env node

import { startServer } from './server.js';
import { getPrismaClient, createRepositories } from '@orkestra/core';

const port = parseInt(process.env['PORT'] ?? '3000', 10);

async function main() {
  console.log('[Orkestra API] Starting server...');

  const prisma = getPrismaClient();
  const repositories = await createRepositories(prisma);

  const server = await startServer({
    port,
    jwtSecret: process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production',
    repositories,
  });

  console.log(`[Orkestra API] Server started successfully on port ${port}`);

  process.on('SIGINT', async () => {
    console.log('[Orkestra API] Shutting down...');
    await prisma.$disconnect();
    server.close(() => {
      console.log('[Orkestra API] Server closed');
      process.exit(0);
    });
  });
}

main().catch((err) => {
  console.error('[Orkestra API] Failed to start:', err);
  process.exit(1);
});
