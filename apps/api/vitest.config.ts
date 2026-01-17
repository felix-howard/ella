/**
 * Vitest Configuration for API Package
 * Unit and integration testing for AI services
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/services/ai/**/*.ts', 'src/jobs/**/*.ts'],
      exclude: ['**/__tests__/**', '**/prompts/**'],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
