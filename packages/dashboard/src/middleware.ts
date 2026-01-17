/**
 * Next.js Middleware
 *
 * Uses NextAuth's built-in middleware for authentication
 */

export { auth as middleware } from '@/lib/auth';

/**
 * Middleware configuration
 */
export const config = {
  // Match all routes except static files, API routes, and auth API routes
  matcher: [
    /*
     * Match all request paths except for:
     * - api/auth/* (NextAuth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
