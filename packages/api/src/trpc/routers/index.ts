/**
 * App Router
 *
 * Combines all tRPC routers into the main application router.
 */

import { router } from '../index.js';
import { workflowRouter } from './workflow.js';
import { taskRouter } from './task.js';
import { conversationRouter } from './conversation.js';
import { adminRouter } from './admin.js';

/**
 * Main application router
 *
 * All API routes are nested under their respective routers:
 * - workflow.* - Workflow operations
 * - task.* - Task operations
 * - conversation.* - Conversation operations
 * - admin.* - Admin operations (tenant, users, groups)
 */
export const appRouter = router({
  workflow: workflowRouter,
  task: taskRouter,
  conversation: conversationRouter,
  admin: adminRouter,
});

/**
 * Export the router type for client usage
 */
export type AppRouter = typeof appRouter;

// Re-export individual routers
export { workflowRouter } from './workflow.js';
export { taskRouter } from './task.js';
export { conversationRouter } from './conversation.js';
export { adminRouter } from './admin.js';

// Re-export router types
export type { WorkflowRouter } from './workflow.js';
export type { TaskRouter } from './task.js';
export type { ConversationRouter } from './conversation.js';
export type { AdminRouter } from './admin.js';
