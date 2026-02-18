import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth, githubOAuthEnabled } from './auth'

/**
 * Server function to get the current session.
 * Used by route beforeLoad guards to check auth status.
 * Returns null if auth DB is unavailable rather than crashing.
 *
 * In CI/E2E environments (BETTER_AUTH_E2E_BYPASS=1), returns a synthetic
 * session so Playwright tests can access protected routes without OAuth.
 */
/**
 * Server function to check whether GitHub OAuth is configured.
 * Called from the login route loader so the client can conditionally
 * show or hide the GitHub sign-in button without exposing credentials.
 */
export const getGithubOAuthEnabled = createServerFn({ method: 'GET' }).handler(
  async () => githubOAuthEnabled,
)

export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    // CI/E2E bypass: allows Playwright smoke tests to access protected routes.
    // Set BETTER_AUTH_E2E_BYPASS=1 in the E2E workflow to enable.
    // Guard: never active in production.
    if (process.env.NODE_ENV !== 'production' && process.env.BETTER_AUTH_E2E_BYPASS === '1') {
      return {
        user: { id: 'e2e-user', email: 'e2e@ci.local', name: 'E2E CI User' },
        session: { id: 'e2e-session', userId: 'e2e-user', expiresAt: new Date(Date.now() + 3_600_000) },
      }
    }
    try {
      const request = getRequest()
      const session = await auth.api.getSession({
        headers: request.headers,
      })
      return session
    } catch {
      return null
    }
  },
)
