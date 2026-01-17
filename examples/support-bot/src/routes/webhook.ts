/**
 * Webhook Route
 *
 * HTTP endpoint for receiving incoming customer messages.
 * This starts a new support conversation workflow for each message.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { Client, WorkflowExecutionAlreadyStartedError, WorkflowIdReusePolicy } from '@temporalio/client';
import { z } from 'zod';

// ============================================================================
// Request Validation
// ============================================================================

/**
 * Schema for incoming message webhook requests
 */
const IncomingMessageSchema = z.object({
  /** Customer's message text */
  message: z.string().min(1, 'Message cannot be empty'),
  /** Unique conversation identifier */
  conversationId: z.string().min(1, 'Conversation ID is required'),
  /** Customer identifier */
  customerId: z.string().min(1, 'Customer ID is required'),
  /** Communication channel */
  channel: z.enum(['chat', 'email', 'slack']).default('chat'),
  /** Tenant identifier for multi-tenancy */
  tenantId: z.string().default('default-tenant'),
});

export type IncomingMessageRequest = z.infer<typeof IncomingMessageSchema>;

/**
 * Schema for webhook response
 */
interface WebhookResponse {
  success: boolean;
  workflowId?: string;
  message?: string;
  error?: string;
}

// ============================================================================
// Route Configuration
// ============================================================================

const TASK_QUEUE = 'support-bot';
const WORKFLOW_ID_PREFIX = 'support';

/**
 * Create the webhook router with the provided Temporal client
 */
export function createWebhookRouter(client: Client): Router {
  const router = Router();

  /**
   * POST /webhook/message
   *
   * Receives an incoming customer message and starts a support conversation workflow.
   */
  router.post(
    '/message',
    async (req: Request, res: Response<WebhookResponse>, next: NextFunction) => {
      try {
        // Validate request body
        const parseResult = IncomingMessageSchema.safeParse(req.body);

        if (!parseResult.success) {
          res.status(400).json({
            success: false,
            error: `Validation error: ${parseResult.error.errors.map((e) => e.message).join(', ')}`,
          });
          return;
        }

        const { message, conversationId, customerId, channel, tenantId } = parseResult.data;

        // Generate a unique workflow ID
        // Using conversationId ensures idempotency - same conversation = same workflow
        const workflowId = `${WORKFLOW_ID_PREFIX}-${conversationId}`;

        console.log('[Webhook] Starting support conversation workflow', {
          workflowId,
          conversationId,
          customerId,
          channel,
          tenantId,
        });

        try {
          // Start the workflow
          const handle = await client.workflow.start('support-conversation', {
            taskQueue: TASK_QUEUE,
            workflowId,
            args: [
              {
                tenantId,
                message,
                conversationId,
                customerId,
                channel,
              },
            ],
            // Set workflow ID reuse policy to allow reusing the ID if the previous run completed
            workflowIdReusePolicy: WorkflowIdReusePolicy.ALLOW_DUPLICATE
          });

          console.log('[Webhook] Workflow started successfully', {
            workflowId: handle.workflowId,
            runId: handle.firstExecutionRunId,
          });

          res.status(202).json({
            success: true,
            workflowId: handle.workflowId,
            message: 'Support conversation started',
          });
        } catch (error) {
          // Handle case where workflow is already running
          if (error instanceof WorkflowExecutionAlreadyStartedError) {
            console.log('[Webhook] Workflow already exists', { workflowId });

            res.status(200).json({
              success: true,
              workflowId,
              message: 'Conversation already in progress',
            });
            return;
          }

          throw error;
        }
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /webhook/health
   *
   * Health check endpoint for the webhook service
   */
  router.get('/health', async (_req: Request, res: Response) => {
    try {
      // Check if Temporal connection is healthy
      await client.connection.ensureConnected();

      res.json({
        status: 'healthy',
        temporal: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status: 'unhealthy',
        temporal: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /webhook/workflow/:workflowId
   *
   * Get the status and result of a workflow
   */
  router.get(
    '/workflow/:workflowId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { workflowId } = req.params;

        const handle = client.workflow.getHandle(workflowId);
        const description = await handle.describe();

        // Try to get the result if completed
        let result: unknown = null;
        if (description.status.name === 'COMPLETED') {
          result = await handle.result();
        }

        res.json({
          workflowId,
          status: description.status.name,
          startTime: description.startTime,
          closeTime: description.closeTime,
          result,
        });
      } catch (error) {
        if ((error as Error).message?.includes('not found')) {
          res.status(404).json({
            error: 'Workflow not found',
            workflowId: req.params.workflowId,
          });
          return;
        }
        next(error);
      }
    }
  );

  return router;
}

/**
 * Error handling middleware for webhook routes
 */
export function webhookErrorHandler(
  error: Error,
  _req: Request,
  res: Response<WebhookResponse>,
  _next: NextFunction
): void {
  console.error('[Webhook] Error:', error);

  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error',
  });
}
