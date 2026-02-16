import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.vinxi/**',
      '.output/**',
      'e2e/**', // Playwright E2E tests run separately
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '.vinxi/',
        '.output/',
        '.tanstack/',
        'convex/_generated/',
        'convex/http.ts', // HTTP handlers tested via integration tests
        'src/routeTree.gen.ts',
        '**/*.config.ts',
        '**/*.config.js',
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        'e2e/**', // Playwright E2E tests run separately
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
