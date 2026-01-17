/**
 * tRPC Context
 *
 * Creates the request context for tRPC procedures, extracting
 * authentication information from headers and setting up
 * the request context for database access.
 */

import type { IncomingMessage } from 'node:http';
import {
  createRequestContext,
  type RequestContext,
  type TenantId,
  type UserId,
  type UserRole,
  type Repositories,
} from '@orkestra/core';
import jwt from 'jsonwebtoken';

/**
 * JWT payload structure
 */
export interface JWTPayload {
  /** Subject (user ID) */
  sub: string;
  /** Tenant ID */
  tenantId: string;
  /** User's email */
  email: string;
  /** User's role */
  role: UserRole;
  /** Issued at timestamp */
  iat: number;
  /** Expiration timestamp */
  exp: number;
}

/**
 * API key payload structure (for machine-to-machine auth)
 */
export interface APIKeyPayload {
  /** API key ID */
  keyId: string;
  /** Tenant ID */
  tenantId: string;
  /** Key permissions */
  permissions: string[];
}

/**
 * Authentication result from header parsing
 */
export interface AuthResult {
  /** Whether the request is authenticated */
  authenticated: boolean;
  /** User ID (if authenticated via JWT) */
  userId?: UserId;
  /** Tenant ID */
  tenantId?: TenantId;
  /** User's email */
  email?: string;
  /** User's role */
  role?: UserRole;
  /** API key ID (if authenticated via API key) */
  apiKeyId?: string;
  /** Permissions (for API key auth) */
  permissions?: string[];
  /** Authentication method */
  method?: 'jwt' | 'api-key';
}

/**
 * tRPC context data
 */
export interface Context {
  /** Authentication result */
  auth: AuthResult;
  /** Request context (for database operations) */
  requestContext: RequestContext | null;
  /** Database repositories */
  repositories: Repositories | null;
  /** Request ID for tracing */
  requestId: string;
  /** Request timestamp */
  requestTimestamp: Date;
}

/**
 * Options for creating context
 */
export interface CreateContextOptions {
  /** Incoming HTTP request */
  req: IncomingMessage;
  /** Database repositories */
  repositories?: Repositories | undefined;
  /** JWT secret for token verification */
  jwtSecret?: string | undefined;
  /** API key validator function */
  validateApiKey?: ((key: string) => Promise<APIKeyPayload | null>) | undefined;
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
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
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
 * Create tRPC context from HTTP request
 *
 * @param opts - Context creation options
 * @returns tRPC context
 */
export async function createContext(opts: CreateContextOptions): Promise<Context> {
  const { req, repositories, jwtSecret, validateApiKey } = opts;
  const requestId = generateRequestId();
  const requestTimestamp = new Date();

  let auth: AuthResult = { authenticated: false };

  // Try JWT authentication first
  const bearerToken = extractBearerToken(req.headers.authorization);
  if (bearerToken && jwtSecret) {
    const payload = verifyJWT(bearerToken, jwtSecret);
    if (payload) {
      auth = {
        authenticated: true,
        userId: payload.sub as UserId,
        tenantId: payload.tenantId as TenantId,
        email: payload.email,
        role: payload.role,
        method: 'jwt',
      };
    }
  }

  // Try API key authentication if JWT failed
  if (!auth.authenticated) {
    const apiKey = extractApiKey(req);
    if (apiKey && validateApiKey) {
      const keyPayload = await validateApiKey(apiKey);
      if (keyPayload) {
        auth = {
          authenticated: true,
          tenantId: keyPayload.tenantId as TenantId,
          apiKeyId: keyPayload.keyId,
          permissions: keyPayload.permissions,
          method: 'api-key',
        };
      }
    }
  }

  // Create request context if authenticated
  let requestContext: RequestContext | null = null;
  if (auth.authenticated && auth.tenantId) {
    requestContext = createRequestContext({
      tenantId: auth.tenantId,
      userId: auth.userId ?? null,
      requestId,
      source: 'api',
    });
  }

  return {
    auth,
    requestContext,
    repositories: repositories ?? null,
    requestId,
    requestTimestamp,
  };
}

/**
 * Create a context factory with pre-configured options
 */
export function createContextFactory(options: Omit<CreateContextOptions, 'req'>) {
  return (req: IncomingMessage) => createContext({ ...options, req });
}
