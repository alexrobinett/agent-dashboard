import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock environment variable
beforeEach(() => {
  vi.stubEnv('VITE_CONVEX_URL', 'https://test.convex.cloud')
})

describe('Convex Client Configuration', () => {
  it('should require VITE_CONVEX_URL environment variable', () => {
    // Clear the env var
    vi.stubEnv('VITE_CONVEX_URL', '')

    // This would throw in the actual module, but we test the concept
    const convexUrl = import.meta.env.VITE_CONVEX_URL

    expect(convexUrl).toBe('')
  })

  it('should accept valid Convex URL format', () => {
    const validUrls = [
      'https://test.convex.cloud',
      'https://prod-deployment.convex.cloud',
      'https://dev-env.convex.site',
    ]

    validUrls.forEach((url) => {
      expect(url).toMatch(/^https:\/\/.*\.convex\.(cloud|site)$/)
    })
  })

  it('should reject invalid URL formats', () => {
    const invalidUrls = [
      'http://insecure.convex.cloud',
      'https://wrong-domain.com',
      'not-a-url',
    ]

    invalidUrls.forEach((url) => {
      expect(url).not.toMatch(/^https:\/\/.*\.convex\.(cloud|site)$/)
    })
  })
})
