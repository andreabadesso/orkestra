/**
 * Temporal Worker
 *
 * This worker processes support conversation workflows and activities.
 * It should be run as a separate process from the HTTP server.
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities/index.js';

// ============================================================================
// Configuration
// ============================================================================

const TASK_QUEUE = process.env.TEMPORAL_TASK_QUEUE || 'support-bot';
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
const NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';

// ============================================================================
// Worker Setup
// ============================================================================

async function run(): Promise<void> {
  console.log('[Worker] Starting Temporal worker...');
  console.log('[Worker] Configuration:', {
    taskQueue: TASK_QUEUE,
    temporalAddress: TEMPORAL_ADDRESS,
    namespace: NAMESPACE,
  });

  // Create connection to Temporal server
  console.log('[Worker] Connecting to Temporal server...');
  const connection = await NativeConnection.connect({
    address: TEMPORAL_ADDRESS,
  });

  console.log('[Worker] Connected to Temporal server');

  try {
    // Create and run the worker
    const worker = await Worker.create({
      connection,
      namespace: NAMESPACE,
      taskQueue: TASK_QUEUE,
      // Register workflows from the workflows directory
      // Note: Workflows must be compiled separately for Temporal's workflow sandbox
      workflowsPath: new URL('./workflows/support-conversation.ts', import.meta.url).pathname,
      // Register activities
      activities,
      // Worker options
      maxConcurrentActivityTaskExecutions: 100,
      maxConcurrentWorkflowTaskExecutions: 100,
    });

    console.log('[Worker] Worker created, starting to poll for tasks...');
    console.log(`[Worker] Task queue: ${TASK_QUEUE}`);

    // Run the worker until shutdown signal
    await worker.run();
  } finally {
    // Clean up connection
    await connection.close();
  }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

function setupShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    console.log(`[Worker] Received ${signal}, shutting down gracefully...`);
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ============================================================================
// Main Entry Point
// ============================================================================

setupShutdownHandlers();

run().catch((error) => {
  console.error('[Worker] Fatal error:', error);
  process.exit(1);
});
