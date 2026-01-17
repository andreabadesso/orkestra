/**
 * NextAuth.js Type Extensions
 *
 * Extends the default NextAuth types to include Orkestra-specific
 * user properties like tenantId, role, and accessToken.
 */

import type { DefaultSession, DefaultUser } from 'next-auth';
import 'next-auth';
import 'next-auth/jwt';

/**
 * Orkestra user role type
 */
type UserRole = 'admin' | 'manager' | 'agent';

declare module 'next-auth' {
  /**
   * Extended User type with Orkestra-specific properties
   */
  interface User extends DefaultUser {
    tenantId: string;
    role: UserRole;
    accessToken?: string;
  }

  /**
   * Extended Session type with Orkestra-specific properties
   */
  interface Session extends DefaultSession {
    user: DefaultSession['user'] & {
      id: string;
      tenantId: string;
      role: UserRole;
    };
    accessToken: string;
    error?: string;
  }
}

declare module 'next-auth/jwt' {
  /**
   * Extended JWT type with Orkestra-specific properties
   */
  interface JWT {
    id: string;
    email?: string | null;
    name?: string | null;
    tenantId: string;
    role: UserRole;
    accessToken: string;
    error?: string;
  }
}
