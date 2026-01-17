/**
 * Authentication Middleware
 *
 * API key validation and authentication utilities.
 */

/**
 * Environment variable name for API key
 */
export const API_KEY_ENV_VAR = 'ORKESTRA_API_KEY';

/**
 * Validation result for API key
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  tenantId?: string;
  userId?: string;
  error?: string;
}

/**
 * Extract API key from environment variables
 */
export function extractApiKeyFromEnv(): string | undefined {
  return process.env[API_KEY_ENV_VAR];
}

/**
 * Validate an API key
 *
 * In a real implementation, this would validate against a database
 * or authentication service. For now, it provides a basic structure.
 *
 * @param apiKey - The API key to validate
 * @returns Validation result with tenant/user info if valid
 */
export async function validateApiKey(
  apiKey: string | undefined
): Promise<ApiKeyValidationResult> {
  // No API key provided
  if (!apiKey) {
    return {
      valid: false,
      error: 'API key is required',
    };
  }

  // Basic format validation
  // API keys should follow the format: ok_<type>_<id>
  // e.g., ok_live_abc123xyz or ok_test_abc123xyz
  const apiKeyRegex = /^ok_(live|test)_[a-zA-Z0-9]{16,}$/;

  if (!apiKeyRegex.test(apiKey)) {
    // For development, also accept simple keys
    if (apiKey.length < 16) {
      return {
        valid: false,
        error: 'API key format is invalid',
      };
    }
  }

  // In a real implementation, we would:
  // 1. Look up the API key in the database
  // 2. Verify it hasn't been revoked
  // 3. Check if it's within rate limits
  // 4. Return the associated tenant and user info

  // For now, return a mock successful validation
  // Extract tenant info from key if it follows our format
  const isTestKey = apiKey.startsWith('ok_test_');

  return {
    valid: true,
    tenantId: `ten_${isTestKey ? 'test' : 'live'}`,
    // userId is optional - API keys may not be tied to a specific user
  };
}

/**
 * Create an authentication header value
 *
 * @param apiKey - The API key to use
 * @returns The Bearer token header value
 */
export function createAuthHeader(apiKey: string): string {
  return `Bearer ${apiKey}`;
}

/**
 * Parse authentication header
 *
 * @param authHeader - The Authorization header value
 * @returns The extracted API key, or undefined if invalid
 */
export function parseAuthHeader(authHeader: string | undefined): string | undefined {
  if (!authHeader) {
    return undefined;
  }

  // Support both "Bearer <token>" and just "<token>"
  const bearerPrefix = 'Bearer ';
  if (authHeader.startsWith(bearerPrefix)) {
    return authHeader.slice(bearerPrefix.length);
  }

  return authHeader;
}
