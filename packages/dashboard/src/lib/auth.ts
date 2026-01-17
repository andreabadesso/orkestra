/**
 * NextAuth Configuration
 *
 * Configures NextAuth.js with credentials provider for the Orkestra dashboard.
 * Uses JWT session strategy and includes tenant/role information in the session.
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { NextAuthConfig } from 'next-auth';

/**
 * Auth configuration for Orkestra dashboard
 */
export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'user@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // In production, this should validate against your API
        // For now, we'll use a placeholder that can be replaced with actual auth logic
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // TODO: Replace with actual API call to validate credentials
        // This is a placeholder for development/testing
        const apiUrl = process.env.ORKESTRA_API_URL || 'http://localhost:3001';

        try {
          const response = await fetch(`${apiUrl}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            return null;
          }

          const data = await response.json();

          // Return the user object with Orkestra-specific fields
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name ?? null,
            tenantId: data.user.tenantId,
            role: data.user.role,
            accessToken: data.accessToken,
          };
        } catch (error) {
          // For development, allow a demo user if API is not available
          if (process.env.NODE_ENV === 'development') {
            if (email === 'demo@orkestra.dev' && password === 'demo123') {
              return {
                id: 'demo-user-id',
                email: 'demo@orkestra.dev',
                name: 'Demo User',
                tenantId: 'demo-tenant',
                role: 'admin' as const,
                accessToken: 'demo-token',
              };
            }
          }
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    /**
     * JWT callback - called when JWT is created or updated
     * Adds Orkestra-specific fields to the token
     */
    async jwt({ token, user }) {
      if (user) {
        // Initial sign in - add user data to token
        token.id = user.id ?? '';
        token.email = user.email;
        token.name = user.name;
        token.tenantId = user.tenantId;
        token.role = user.role;
        token.accessToken = user.accessToken ?? '';
      }
      return token;
    },

    /**
     * Session callback - called when session is accessed
     * Exposes Orkestra-specific fields to the client
     */
    async session({ session, token }) {
      // Extend the existing session.user with Orkestra fields
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as 'admin' | 'manager' | 'agent';
      }
      session.accessToken = token.accessToken as string;

      if (token.error) {
        session.error = token.error as string;
      }

      return session;
    },

    /**
     * Authorized callback - determines if a request is authorized
     */
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      // Public routes that don't require authentication
      const publicRoutes = ['/login', '/api/auth'];
      const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

      if (isPublicRoute) {
        return true;
      }

      // All other routes require authentication
      return isLoggedIn;
    },
  },

  // Trust proxy headers in production (for load balancers)
  trustHost: true,

  // Debug mode in development
  debug: process.env.NODE_ENV === 'development',
};

/**
 * NextAuth instance
 */
const nextAuth = NextAuth(authConfig);

/**
 * NextAuth handlers for API routes
 */
export const handlers = nextAuth.handlers;

/**
 * Auth function to get the session in server components
 */
export const auth = nextAuth.auth;

/**
 * Sign in function
 */
export const signIn = nextAuth.signIn;

/**
 * Sign out function
 */
export const signOut = nextAuth.signOut;
