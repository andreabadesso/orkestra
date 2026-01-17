/**
 * Tests for configuration loading and validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadConfig,
  validateConfig,
  requireEnv,
  ConfigurationError,
  orkestraConfigSchema,
  databaseConfigSchema,
  temporalConfigSchema,
} from '../config/index.js';

describe('Configuration', () => {
  // Store original env
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('ORKESTRA_') || ['DATABASE_URL', 'JWT_SECRET', 'NODE_ENV', 'BASE_URL', 'PORT', 'HOST'].includes(key)) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe('databaseConfigSchema', () => {
    it('should validate valid database config', () => {
      const config = {
        url: 'postgresql://user:pass@localhost:5432/orkestra',
        maxConnections: 10,
      };
      const result = databaseConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const config = {
        url: 'invalid-url',
        maxConnections: 10,
      };
      const result = databaseConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should apply default values', () => {
      const config = {
        url: 'postgresql://localhost/orkestra',
      };
      const result = databaseConfigSchema.parse(config);
      expect(result.maxConnections).toBe(10);
      expect(result.connectionTimeoutMs).toBe(10000);
      expect(result.idleTimeoutMs).toBe(60000);
    });

    it('should reject maxConnections out of range', () => {
      const config = {
        url: 'postgresql://localhost/orkestra',
        maxConnections: 200,
      };
      const result = databaseConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('temporalConfigSchema', () => {
    it('should validate valid temporal config', () => {
      const config = {
        address: 'localhost:7233',
        namespace: 'default',
        taskQueue: 'orkestra-main',
      };
      const result = temporalConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should apply default values', () => {
      const config = {};
      const result = temporalConfigSchema.parse(config);
      expect(result.address).toBe('localhost:7233');
      expect(result.namespace).toBe('default');
      expect(result.taskQueue).toBe('orkestra-main');
      expect(result.tls).toBe(false);
    });
  });

  describe('orkestraConfigSchema', () => {
    it('should validate complete config', () => {
      const config = {
        env: 'development',
        database: {
          url: 'postgresql://localhost/orkestra',
        },
        temporal: {
          address: 'localhost:7233',
        },
        server: {
          port: 3000,
        },
        auth: {
          jwtSecret: 'this-is-a-very-long-secret-key-for-jwt-signing',
        },
      };
      const result = orkestraConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject config with missing required fields', () => {
      const config = {
        env: 'development',
        // Missing database.url and auth.jwtSecret
      };
      const result = orkestraConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid env value', () => {
      const config = {
        env: 'invalid',
        database: { url: 'postgresql://localhost/orkestra' },
        auth: { jwtSecret: 'this-is-a-very-long-secret-key-for-jwt-signing' },
      };
      const result = orkestraConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('loadConfig', () => {
    it('should load config from environment variables', () => {
      process.env['ORKESTRA_DATABASE_URL'] = 'postgresql://localhost/orkestra';
      process.env['ORKESTRA_AUTH_JWT_SECRET'] = 'this-is-a-very-long-secret-key-for-jwt-signing';
      process.env['ORKESTRA_SERVER_PORT'] = '4000';
      process.env['ORKESTRA_ENV'] = 'production';

      const config = loadConfig();

      expect(config.database.url).toBe('postgresql://localhost/orkestra');
      expect(config.auth.jwtSecret).toBe('this-is-a-very-long-secret-key-for-jwt-signing');
      expect(config.server.port).toBe(4000);
      expect(config.env).toBe('production');
    });

    it('should support unprefixed env vars', () => {
      process.env['DATABASE_URL'] = 'postgresql://localhost/orkestra';
      process.env['JWT_SECRET'] = 'this-is-a-very-long-secret-key-for-jwt-signing';
      process.env['PORT'] = '5000';

      const config = loadConfig();

      expect(config.database.url).toBe('postgresql://localhost/orkestra');
      expect(config.auth.jwtSecret).toBe('this-is-a-very-long-secret-key-for-jwt-signing');
      expect(config.server.port).toBe(5000);
    });

    it('should allow overrides', () => {
      process.env['ORKESTRA_DATABASE_URL'] = 'postgresql://localhost/orkestra';
      process.env['ORKESTRA_AUTH_JWT_SECRET'] = 'this-is-a-very-long-secret-key-for-jwt-signing';

      const config = loadConfig({
        server: { port: 9000 } as Partial<typeof config.server>,
      } as Partial<typeof config>);

      expect(config.server.port).toBe(9000);
    });

    it('should throw ConfigurationError on validation failure', () => {
      process.env['ORKESTRA_DATABASE_URL'] = 'invalid-url';
      process.env['ORKESTRA_AUTH_JWT_SECRET'] = 'short';

      expect(() => loadConfig()).toThrow(ConfigurationError);
    });

    it('should parse boolean env vars', () => {
      process.env['ORKESTRA_DATABASE_URL'] = 'postgresql://localhost/orkestra';
      process.env['ORKESTRA_AUTH_JWT_SECRET'] = 'this-is-a-very-long-secret-key-for-jwt-signing';
      process.env['ORKESTRA_TEMPORAL_TLS'] = 'true';

      const config = loadConfig();

      expect(config.temporal.tls).toBe(true);
    });

    it('should parse array env vars', () => {
      process.env['ORKESTRA_DATABASE_URL'] = 'postgresql://localhost/orkestra';
      process.env['ORKESTRA_AUTH_JWT_SECRET'] = 'this-is-a-very-long-secret-key-for-jwt-signing';
      process.env['ORKESTRA_CORS_ORIGINS'] = 'http://localhost:3000,https://example.com';

      const config = loadConfig();

      expect(config.server.cors.origins).toEqual(['http://localhost:3000', 'https://example.com']);
    });
  });

  describe('validateConfig', () => {
    it('should return success for valid config', () => {
      const config = {
        database: { url: 'postgresql://localhost/orkestra' },
        temporal: {},
        server: {},
        auth: { jwtSecret: 'this-is-a-very-long-secret-key-for-jwt-signing' },
      };

      const result = validateConfig(config);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return errors for invalid config', () => {
      const config = {
        database: { url: 'invalid' },
        auth: { jwtSecret: 'short' },
      };

      const result = validateConfig(config);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('requireEnv', () => {
    it('should return env var value when set', () => {
      process.env['ORKESTRA_TEST_VAR'] = 'test-value';
      expect(requireEnv('TEST_VAR')).toBe('test-value');
    });

    it('should throw ConfigurationError when not set', () => {
      expect(() => requireEnv('NONEXISTENT_VAR')).toThrow(ConfigurationError);
    });
  });

  describe('ConfigurationError', () => {
    it('should have correct name', () => {
      const error = new ConfigurationError('test error');
      expect(error.name).toBe('ConfigurationError');
    });

    it('should include validation errors', () => {
      const errors = [{ path: ['database', 'url'], message: 'Invalid URL', code: 'custom' as const }];
      const error = new ConfigurationError('Validation failed', errors as never);
      expect(error.errors).toEqual(errors);
    });
  });
});
