import { redirect } from '@tanstack/react-router'

export type Session = {
  userId: string
  expiresAt: number
}

export type SessionReader = () => Session | null

/**
 * Sign in a user by creating a new session that expires after `ttlMs` milliseconds.
 * Returns a plain Session value; the caller is responsible for persisting it.
 */
export function signIn(userId: string, ttlMs: number, now: number = Date.now()): Session {
  return {
    userId,
    expiresAt: now + ttlMs,
  }
}

/**
 * @deprecated Use `signIn` instead.
 * Alias kept for backwards compatibility; delegates to signIn.
 */
export function createSession(userId: string, ttlMs: number, now: number = Date.now()): Session {
  return signIn(userId, ttlMs, now)
}

/**
 * Returns `true` when the session's expiry timestamp is at or before `now`.
 * A session expiring at exactly `now` is considered expired.
 */
export function isSessionExpired(session: Session, now: number = Date.now()): boolean {
  return session.expiresAt <= now
}

/**
 * Sign out by returning `null`, which represents a cleared session.
 *
 * Follows the caller-owns-storage pattern: the returned `null` should be
 * written back to wherever the session is stored (localStorage, a cookie,
 * React state, etc.).  This function itself has no side effects.
 */
export function signOut(): null {
  return null
}

/**
 * Refresh an active session by extending its TTL.
 * Returns a **new** Session object with `expiresAt` set to `now + ttlMs`.
 * The caller is responsible for persisting the returned session.
 */
export function refreshSession(
  session: Session,
  ttlMs: number,
  now: number = Date.now(),
): Session {
  return {
    userId: session.userId,
    expiresAt: now + ttlMs,
  }
}

/**
 * Returns the current active session, or `null` if there is none or it has expired.
 */
export function getActiveSession(getSession: SessionReader, now: number = Date.now()): Session | null {
  const session = getSession()
  if (!session) return null
  return isSessionExpired(session, now) ? null : session
}

/**
 * Returns the active session, or throws a TanStack Router redirect to `/login`
 * if no active (non-expired) session exists.
 */
export function requireActiveSession(getSession: SessionReader, now: number = Date.now()): Session {
  const session = getActiveSession(getSession, now)
  if (!session) {
    throw redirect({ to: '/login' })
  }
  return session
}
