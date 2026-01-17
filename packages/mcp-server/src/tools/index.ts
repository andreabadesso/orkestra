/**
 * Tool Definitions Export
 *
 * Exports all MCP tool definitions for Orkestra.
 */

export { workflowTools, handleWorkflowTool } from './workflows.js';
export { taskTools, handleTaskTool } from './tasks.js';
export { conversationTools, handleConversationTool } from './conversations.js';
export { userTools, handleUserTool } from './users.js';

// Re-export all tools as a combined array
import { workflowTools } from './workflows.js';
import { taskTools } from './tasks.js';
import { conversationTools } from './conversations.js';
import { userTools } from './users.js';

export const allTools = [
  ...workflowTools,
  ...taskTools,
  ...conversationTools,
  ...userTools,
];
