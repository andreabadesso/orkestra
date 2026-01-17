/**
 * tRPC API Route Handler
 *
 * Handles all tRPC requests from the frontend.
 *
 * NOTE: This is a simplified handler for development.
 * In production, the dashboard should connect to a separate API server.
 */

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { initTRPC } from '@trpc/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';

/**
 * Initialize tRPC
 */
const t = initTRPC.create();

/**
 * Mock task router for development
 * This returns empty data until the real API server is connected
 */
const taskRouter = t.router({
  stats: t.procedure.query(async () => {
    // Return mock stats for now
    return {
      pending: 0,
      inProgress: 0,
      completed: 0,
      overdue: 0,
    };
  }),

  pending: t.procedure
    .input(z.object({ includeGroupTasks: z.boolean().optional() }).optional())
    .query(async () => {
      // Return empty task list for now
      return {
        items: [],
        total: 0,
      };
    }),

  get: t.procedure
    .input(z.object({
      id: z.string(),
      includeHistory: z.boolean().optional(),
    }))
    .query(async () => {
      // Return null - task not found
      return null;
    }),

  claim: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(async () => {
      throw new Error('API not connected. Please start the Orkestra API server.');
    }),

  complete: t.procedure
    .input(z.object({
      id: z.string(),
      result: z.record(z.unknown()),
    }))
    .mutation(async () => {
      throw new Error('API not connected. Please start the Orkestra API server.');
    }),
});

/**
 * Root app router (mock)
 */
const appRouter = t.router({
  task: taskRouter,
});

export type AppRouter = typeof appRouter;

const handler = async (req: Request) => {
  const session = await auth();

  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: async () => {
      return {
        session,
        auth: {
          authenticated: !!session?.user,
          userId: session?.user?.id,
          tenantId: session?.user?.tenantId,
          email: session?.user?.email,
          role: session?.user?.role,
        },
      };
    },
    onError({ error, path }) {
      console.error(`tRPC Error on ${path}:`, error);
    },
  });
};

export { handler as GET, handler as POST };
