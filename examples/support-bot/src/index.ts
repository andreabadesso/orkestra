/**
 * Support Bot Example - Main Entry Point
 *
 * This is the HTTP server that receives incoming messages via webhooks
 * and starts support conversation workflows.
 */

import express, { type Express, type Request, type Response } from 'express';
import { Client, Connection } from '@temporalio/client';
import { createWebhookRouter, webhookErrorHandler } from './routes/webhook.js';

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';

// ============================================================================
// Server Setup
// ============================================================================

async function createServer(): Promise<Express> {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req: Request, _res: Response, next) => {
    console.log(`[HTTP] ${req.method} ${req.path}`);
    next();
  });

  // Create Temporal client
  console.log('[Server] Connecting to Temporal server...');
  const connection = await Connection.connect({
    address: TEMPORAL_ADDRESS,
  });

  const client = new Client({
    connection,
    namespace: TEMPORAL_NAMESPACE,
  });

  console.log('[Server] Connected to Temporal server');

  // Mount webhook routes
  app.use('/webhook', createWebhookRouter(client));
  app.use('/webhook', webhookErrorHandler);

  // Root endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Support Bot Example',
      version: '0.0.1',
      description: 'AI-first support bot with human escalation using Orkestra',
      endpoints: {
        'POST /webhook/message': 'Receive incoming customer messages',
        'GET /webhook/health': 'Health check',
        'GET /webhook/workflow/:id': 'Get workflow status',
      },
    });
  });

  // Health check
  app.get('/health', async (_req: Request, res: Response) => {
    try {
      await connection.ensureConnected();
      res.json({ status: 'healthy', temporal: 'connected' });
    } catch {
      res.status(503).json({ status: 'unhealthy', temporal: 'disconnected' });
    }
  });

  return app;
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

function setupShutdownHandlers(server: import('http').Server): void {
  const shutdown = async (signal: string) => {
    console.log(`[Server] Received ${signal}, shutting down gracefully...`);

    server.close((err) => {
      if (err) {
        console.error('[Server] Error during shutdown:', err);
        process.exit(1);
      }
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after timeout
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  try {
    console.log('[Server] Starting Support Bot Example...');
    console.log('[Server] Configuration:', {
      port: PORT,
      host: HOST,
      temporalAddress: TEMPORAL_ADDRESS,
      namespace: TEMPORAL_NAMESPACE,
    });

    const app = await createServer();

    const server = app.listen(PORT, HOST, () => {
      console.log(`[Server] Listening on http://${HOST}:${PORT}`);
      console.log('[Server] Ready to receive messages');
      console.log('');
      console.log('Usage:');
      console.log('  curl -X POST http://localhost:3000/webhook/message \\');
      console.log('    -H "Content-Type: application/json" \\');
      console.log('    -d \'{"message": "Hello, I need help", "conversationId": "conv_123", "customerId": "cust_001"}\'');
      console.log('');
    });

    setupShutdownHandlers(server);
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

main();
