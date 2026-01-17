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
import { tenantSettingsRouter } from './settings.js';
import { userManagementRouter } from './user.js';

/**
 * Main application router
 *
 * All API routes are nested under their respective routers:
 * - workflow.* - Workflow operations
 * - task.* - Task operations
 * - conversation.* - Conversation operations
 * - adminRouter.* - Admin operations (tenant, users, groups)
 * - tenantSettings.* - Tenant settings operations (branding, notifications, task behavior)
 * - userManagement.* - User CRUD operations for dashboard
 *
 * Note: Router keys use Router suffix to avoid tRPC built-in property name collisions
 */
export const appRouter = router({
  workflow: workflowRouter,
  task: taskRouter,
  conversation: conversationRouter,
  admin: adminRouter,
  tenantSettings: tenantSettingsRouter,
  userManagement: userManagementRouter,
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
export { tenantSettingsRouter } from './settings.js';
export { userManagementRouter } from './user.js';

// Re-export router types
export type { WorkflowRouter } from './workflow.js';
export type { TaskRouter } from './task.js';
export type { ConversationRouter } from './conversation.js';
export type { AdminRouter } from './admin.js';
export type { TenantSettingsRouter } from './settings.js';
export type { UserRouter } from './user.js';
