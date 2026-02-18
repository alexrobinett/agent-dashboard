import { redirect } from '@tanstack/react-router'

export type Session = {
  userId: string
  expiresAt: number
}

export type SessionReader = () => Session | null

export function createSession(userId: string, ttlMs: number, now: number = Date.now()): Session {
  return {
    userId,
    expiresAt: now + ttlMs,
  }
}

export function isSessionExpired(session: Session, now: number = Date.now()): boolean {
  return session.expiresAt <= now
}

export function signIn(userId: string, ttlMs: number, now: number = Date.now()): Session {
  return createSession(userId, ttlMs, now)
}

export function signOut(): null {
  return null
}

export function getActiveSession(getSession: SessionReader, now: number = Date.now()): Session | null {
  const session = getSession()
  if (!session) return null
  return isSessionExpired(session, now) ? null : session
}

export function requireActiveSession(getSession: SessionReader, now: number = Date.now()): Session {
  const session = getActiveSession(getSession, now)
  if (!session) {
    throw redirect({ to: '/login' })
  }
  return session
}
