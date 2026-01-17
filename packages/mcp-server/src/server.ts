/**
 * MCP Server Setup
 *
 * Creates and configures the MCP server for Orkestra.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import type { ServerOptions, OrkestraServices } from './types.js';
import { workflowTools, handleWorkflowTool } from './tools/workflows.js';
import { taskTools, handleTaskTool } from './tools/tasks.js';
import { conversationTools, handleConversationTool } from './tools/conversations.js';
import { userTools, handleUserTool } from './tools/users.js';
import { resources, handleResourceRead } from './resources/handlers.js';

const DEFAULT_SERVER_NAME = 'orkestra-mcp';
const DEFAULT_VERSION = '0.0.1';

/**
 * Creates a new MCP server instance configured for Orkestra
 */
export function createMCPServer(
  options: ServerOptions = {},
  services?: OrkestraServices
): Server {
  const serverName = options.name ?? DEFAULT_SERVER_NAME;
  const serverVersion = options.version ?? DEFAULT_VERSION;

  const server = new Server(
    {
      name: serverName,
      version: serverVersion,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register tool listing handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        ...workflowTools,
        ...taskTools,
        ...conversationTools,
        ...userTools,
      ],
    };
  });

  // Register tool execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (options.debug) {
      console.error(`[DEBUG] Tool called: ${name}`, JSON.stringify(args));
    }

    try {
      // Route to appropriate handler based on tool name prefix
      if (name.startsWith('workflow_')) {
        return await handleWorkflowTool(name, args ?? {}, services?.workflows);
      }

      if (name.startsWith('task_')) {
        return await handleTaskTool(name, args ?? {}, services?.tasks);
      }

      if (name.startsWith('conversation_')) {
        return await handleConversationTool(name, args ?? {}, services?.conversations);
      }

      if (name.startsWith('user_') || name.startsWith('group_')) {
        return await handleUserTool(name, args ?? {}, services?.users);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Unknown tool: ${name}`,
            }),
          },
        ],
        isError: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (options.debug) {
        console.error(`[ERROR] Tool ${name} failed:`, errorMessage);
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: errorMessage,
            }),
          },
        ],
        isError: true,
      };
    }
  });

  // Register resource listing handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources };
  });

  // Register resource read handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (options.debug) {
      console.error(`[DEBUG] Resource requested: ${uri}`);
    }

    try {
      return await handleResourceRead(uri, services);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (options.debug) {
        console.error(`[ERROR] Resource ${uri} failed:`, errorMessage);
      }
      throw error;
    }
  });

  return server;
}

/**
 * Runs the MCP server using stdio transport
 */
export async function runMCPServer(
  server: Server,
  options: { debug?: boolean } = {}
): Promise<void> {
  const transport = new StdioServerTransport();

  if (options.debug) {
    console.error('[DEBUG] Starting MCP server with stdio transport');
  }

  await server.connect(transport);

  if (options.debug) {
    console.error('[DEBUG] MCP server connected and running');
  }
}

/**
 * Convenience function to create and run the server
 */
export async function startMCPServer(
  options: ServerOptions = {},
  services?: OrkestraServices
): Promise<Server> {
  const server = createMCPServer(options, services);
  await runMCPServer(server, { debug: options.debug ?? false });
  return server;
}
