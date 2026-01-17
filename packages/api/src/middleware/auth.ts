/**
 * Authentication Middleware
 *
 * Provides HTTP-level authentication middleware for use with
 * standalone HTTP servers (outside of tRPC).
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import jwt from 'jsonwebtoken';
import type { JWTPayload, APIKeyPayload } from '../trpc/context.js';

/**
 * Auth middleware options
 */
export interface AuthMiddlewareOptions {
  /** JWT secret for token verification */
  jwtSecret?: string;
  /** API key validator function */
  validateApiKey?: (key: string) => Promise<APIKeyPayload | null>;
  /** Paths that don't require authentication */
  publicPaths?: string[];
  /** Whether to allow unauthenticated requests (auth info will be null) */
  allowUnauthenticated?: boolean;
}

/**
 * Extended request with auth info
 */
export interface AuthenticatedRequest extends IncomingMessage {
  auth?: {
    authenticated: boolean;
    userId?: string;
    tenantId?: string;
    email?: string;
    role?: string;
    apiKeyId?: string;
    permissions?: string[];
    method?: 'jwt' | 'api-key';
  };
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const [type, token] = authHeader.split(' ');
  if (type?.toLowerCase() === 'bearer' && token) {
    return token;
  }
  return null;
}

/**
 * Extract API key from X-API-Key header
 */
function extractApiKey(req: IncomingMessage): string | null {
  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey === 'string' && apiKey.length > 0) {
    return apiKey;
  }
  return null;
}

/**
 * Check if a path is in the public paths list
 */
function isPublicPath(url: string | undefined, publicPaths: string[]): boolean {
  if (!url) return false;
  const pathname = url.split('?')[0];
  return publicPaths.some(path => {
    if (path.endsWith('*')) {
      return pathname?.startsWith(path.slice(0, -1));
    }
    return pathname === path;
  });
}

/**
 * Verify and decode a JWT token
 */
function verifyJWT(token: string, secret: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, secret) as JWTPayload;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  const {
    jwtSecret,
    validateApiKey,
    publicPaths = [],
    allowUnauthenticated = false,
  } = options;

  return async (
    req: AuthenticatedRequest,
    res: ServerResponse,
    next: () => void
  ): Promise<void> => {
    // Initialize auth as unauthenticated
    req.auth = { authenticated: false };

    // Skip auth for public paths
    if (isPublicPath(req.url, publicPaths)) {
      next();
      return;
    }

    // Try JWT authentication first
    const bearerToken = extractBearerToken(req.headers.authorization);
    if (bearerToken && jwtSecret) {
      const payload = verifyJWT(bearerToken, jwtSecret);
      if (payload) {
        req.auth = {
          authenticated: true,
          userId: payload.sub,
          tenantId: payload.tenantId,
          email: payload.email,
          role: payload.role,
          method: 'jwt',
        };
        next();
        return;
      }
    }

    // Try API key authentication
    const apiKey = extractApiKey(req);
    if (apiKey && validateApiKey) {
      const keyPayload = await validateApiKey(apiKey);
      if (keyPayload) {
        req.auth = {
          authenticated: true,
          tenantId: keyPayload.tenantId,
          apiKeyId: keyPayload.keyId,
          permissions: keyPayload.permissions,
          method: 'api-key',
        };
        next();
        return;
      }
    }

    // If no valid auth and not allowing unauthenticated
    if (!allowUnauthenticated) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Unauthorized',
        message: 'Authentication required',
      }));
      return;
    }

    // Allow unauthenticated request to proceed
    next();
  };
}

/**
 * Create a simple token generator for testing
 */
export function generateToken(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string,
  expiresInSeconds: number = 86400
): string {
  return jwt.sign(payload, secret, { expiresIn: expiresInSeconds });
}

/**
 * Decode a token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}
