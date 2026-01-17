/**
 * useUser Hook
 *
 * Provides easy access to the current user's session information
 * with Orkestra-specific fields like tenantId and role.
 */

'use client';

import { useSession } from 'next-auth/react';

/**
 * User data from the session
 */
export interface UserData {
  id: string;
  email: string;
  name: string | null;
  tenantId: string;
  role: 'admin' | 'manager' | 'agent';
}

/**
 * Hook return type
 */
export interface UseUserResult {
  /** The current user, or null if not authenticated */
  user: UserData | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether the session is still loading */
  isLoading: boolean;
  /** The access token for API calls */
  accessToken: string | null;
  /** Any error message from the session */
  error: string | null;
  /** Whether the user has admin role */
  isAdmin: boolean;
  /** Whether the user has manager role (includes admin) */
  isManager: boolean;
}

/**
 * Hook to access the current user's session information
 *
 * @returns User data, loading state, and role helpers
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, isAdmin } = useUser();
 *
 *   if (!isAuthenticated) {
 *     return <div>Please log in</div>;
 *   }
 *
 *   return (
 *     <div>
 *       Welcome, {user.name}!
 *       {isAdmin && <AdminPanel />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useUser(): UseUserResult {
  const { data: session, status } = useSession();

  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated' && !!session?.user;

  const user: UserData | null = isAuthenticated && session?.user && session.user.email
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name ?? null,
        tenantId: session.user.tenantId,
        role: session.user.role,
      }
    : null;

  const accessToken = session?.accessToken ?? null;
  const error = session?.error ?? null;

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  return {
    user,
    isAuthenticated,
    isLoading,
    accessToken,
    error,
    isAdmin,
    isManager,
  };
}

export default useUser;
