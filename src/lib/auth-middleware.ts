import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from './auth'

/**
 * Server function to get the current session.
 * Used by route beforeLoad guards to check auth status.
 * Returns null if auth DB is unavailable rather than crashing.
 */
export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
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
