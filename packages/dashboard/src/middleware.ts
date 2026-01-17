/**
 * Next.js Middleware
 *
 * Handles route protection and authentication redirects:
 * - Redirects unauthenticated users to /login
 * - Redirects authenticated users away from /login
 * - Checks admin role for /admin routes
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Middleware configuration
 */
export const config = {
  // Match all routes except static files and API routes
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api).*)',
  ],
};

/**
 * Routes that don't require authentication
 */
const publicRoutes = ['/login'];

/**
 * Routes that require admin role
 */
const adminRoutes = ['/admin'];

/**
 * Check if a path matches any of the given routes
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Middleware handler
 */
export default auth((request) => {
  const { pathname } = request.nextUrl;
  const session = request.auth;
  const isLoggedIn = !!session?.user;
  const userRole = session?.user?.role;

  // Handle public routes
  if (matchesRoute(pathname, publicRoutes)) {
    // Redirect authenticated users away from login
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Handle unauthenticated users
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    // Preserve the original URL as a callback
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Handle admin routes
  if (matchesRoute(pathname, adminRoutes)) {
    if (userRole !== 'admin') {
      // Redirect non-admins to home with an error
      const homeUrl = new URL('/', request.url);
      homeUrl.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(homeUrl);
    }
  }

  // Allow the request to proceed
  return NextResponse.next();
});
