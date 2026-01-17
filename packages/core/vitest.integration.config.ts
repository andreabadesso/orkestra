/**
 * Vitest Integration Test Configuration
 *
 * Configuration for running integration tests with mocked infrastructure.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Include only integration tests
    include: ['tests/integration/**/*.test.ts'],

    // Exclude unit tests and fixtures
    exclude: ['src/**/*.test.ts', 'tests/fixtures/**'],

    // Longer timeout for integration tests
    testTimeout: 30000,

    // Hook timeout
    hookTimeout: 10000,

    // Run tests sequentially by default for integration tests
    // (can be overridden with --parallel flag)
    sequence: {
      shuffle: false,
    },

    // Environment
    environment: 'node',

    // Global setup for all integration tests
    globals: true,

    // Coverage configuration (optional)
    coverage: {
      enabled: false,
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**'],
      reporter: ['text', 'json', 'html'],
    },

    // TypeScript configuration
    typecheck: {
      enabled: false, // Separate typecheck step
    },

    // Reporter configuration
    reporters: ['default'],

    // Output directory for test results
    outputFile: {
      junit: './test-results/integration-junit.xml',
    },
  },

  // Resolve configuration
  resolve: {
    alias: {
      // Ensure proper resolution of local imports
    },
  },

  // ESBuild configuration for faster transforms
  esbuild: {
    target: 'node20',
  },
});
