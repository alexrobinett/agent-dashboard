import { createServerFn } from '@tanstack/react-start'
import { getWebRequest } from '@tanstack/react-start/server'
import { auth } from './auth'

/**
 * Server function to get the current session.
 * Used by route beforeLoad guards to check auth status.
 */
export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getWebRequest()
    const session = await auth.api.getSession({
      headers: request.headers,
    })
    return session
  },
)
