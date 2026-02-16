/**
 * Test Setup
 * Sprint 3.4: Shared test utilities
 * 
 * Global test setup and configuration
 */

import { beforeAll, afterAll, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Setup mock environment variables
beforeAll(() => {
  process.env.VITE_CONVEX_URL = 'https://test.convex.cloud'
})

// Cleanup after all tests
afterAll(() => {
  // Any global cleanup
})
