/**
 * tRPC Client Configuration
 *
 * Sets up the tRPC React client for type-safe API calls from the dashboard.
 * Includes authentication headers from the NextAuth session.
 */

'use client';

import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import type { AppRouter } from '@orkestra/api';

/**
 * tRPC React hooks
 *
 * Use this to access tRPC procedures in React components:
 * - trpc.workflow.list.useQuery()
 * - trpc.task.complete.useMutation()
 * - etc.
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Get the tRPC API URL from environment or default
 */
function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use relative URL or configured API URL
    return process.env.NEXT_PUBLIC_API_URL || '/api/trpc';
  }
  // Server-side: use full URL
  return process.env.ORKESTRA_API_URL || 'http://localhost:3001/trpc';
}

/**
 * Create tRPC client links with authentication
 *
 * @param getToken - Function to get the current access token
 */
export function createTRPCLinks(getToken: () => string | null) {
  return [
    httpBatchLink({
      url: getApiUrl(),
      headers: () => {
        const token = getToken();
        return token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {};
      },
    }),
  ];
}

/**
 * Type-safe tRPC client type
 */
export type TRPCClient = ReturnType<typeof trpc.createClient>;

/**
 * Re-export AppRouter type for convenience
 */
export type { AppRouter };
