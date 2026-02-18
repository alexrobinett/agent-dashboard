/**
 * Auth config validation tests.
 *
 * Verifies the Better Auth configuration without initialising a real database.
 * `better-auth` and `better-sqlite3` are mocked so no filesystem or network
 * access occurs during the test run.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks — declared before any imports that use them.
// ---------------------------------------------------------------------------
const { capturedConfig } = vi.hoisted(() => ({
  capturedConfig: { current: null as Record<string, unknown> | null },
}))

vi.mock('better-auth', () => ({
  betterAuth: vi.fn((config: Record<string, unknown>) => {
    capturedConfig.current = config
    return { _config: config }
  }),
}))

// better-sqlite3 exports a class as its default export. The mock must be a
// real constructor function (not an arrow function) so `new Database(...)` works.
vi.mock('better-sqlite3', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: function MockDatabase(_path: string) {} as any,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function loadAuthModule() {
  vi.resetModules()
  const mod = await import('../../lib/auth')
  return mod
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Better Auth config — useSecureCookies', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    capturedConfig.current = null
  })

  it('sets useSecureCookies to true in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('BETTER_AUTH_SECRET', 'a'.repeat(32))
    vi.stubEnv('BETTER_AUTH_DB_URL', '/tmp/test.db')
    vi.stubEnv('GITHUB_CLIENT_ID', 'test-client-id')
    vi.stubEnv('GITHUB_CLIENT_SECRET', 'test-client-secret')

    await loadAuthModule()

    expect(capturedConfig.current).not.toBeNull()
    expect(capturedConfig.current!.useSecureCookies).toBe(true)
  })

  it('sets useSecureCookies to false in test environment', async () => {
    vi.stubEnv('NODE_ENV', 'test')

    await loadAuthModule()

    expect(capturedConfig.current).not.toBeNull()
    expect(capturedConfig.current!.useSecureCookies).toBe(false)
  })

  it('sets useSecureCookies to false in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    await loadAuthModule()

    expect(capturedConfig.current).not.toBeNull()
    expect(capturedConfig.current!.useSecureCookies).toBe(false)
  })
})

describe('Better Auth config — other required options', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    capturedConfig.current = null
  })

  it('includes a baseURL in the config', async () => {
    await loadAuthModule()

    expect(capturedConfig.current).not.toBeNull()
    expect(capturedConfig.current!.baseURL).toBeDefined()
  })

  it('includes a database in the config', async () => {
    await loadAuthModule()

    expect(capturedConfig.current).not.toBeNull()
    expect(capturedConfig.current!.database).toBeDefined()
  })
})
