/**
 * @orkestra/mcp-server
 *
 * MCP (Model Context Protocol) server for Orkestra.
 * This package enables AI agents to interact with Orkestra
 * using the standardized MCP protocol.
 *
 * @example
 * ```typescript
 * import { createMCPServer, runMCPServer } from '@orkestra/mcp-server';
 *
 * // Create and run the server
 * const server = createMCPServer({ debug: true });
 * await runMCPServer(server);
 * ```
 *
 * @example With services
 * ```typescript
 * import { createMCPServer, startMCPServer } from '@orkestra/mcp-server';
 * import { workflowService, taskService } from './services';
 *
 * // Create server with real services
 * const server = await startMCPServer(
 *   { name: 'my-orkestra', version: '1.0.0' },
 *   {
 *     workflows: workflowService,
 *     tasks: taskService,
 *     conversations: conversationService,
 *     users: userService,
 *   }
 * );
 * ```
 */

export const VERSION = '0.0.1';

// Standalone server entry point
export { main as runStandaloneMCPServer } from './standalone.js';

// Server exports
export { createMCPServer, runMCPServer, startMCPServer } from './server.js';

// Type exports
export type {
  ServerOptions,
  RequestContext,
  ToolResult,
  WorkflowService,
  TaskService,
  ConversationService,
  UserService,
  OrkestraServices,
} from './types.js';

// Tool exports
export {
  workflowTools,
  handleWorkflowTool,
  taskTools,
  handleTaskTool,
  conversationTools,
  handleConversationTool,
  userTools,
  handleUserTool,
  allTools,
} from './tools/index.js';

// Resource exports
export { resources, handleResourceRead } from './resources/index.js';

// Middleware exports
export {
  validateApiKey,
  extractApiKeyFromEnv,
  createRequestContext,
  generateRequestId,
} from './middleware/index.js';
