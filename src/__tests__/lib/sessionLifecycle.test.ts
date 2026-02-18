import { describe, expect, it, vi, beforeEach } from 'vitest'

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((options: { to: string }) => ({
    __redirect: true,
    ...options,
  })),
}))

vi.mock('@tanstack/react-router', () => ({
  redirect: redirectMock,
}))

import {
  createSession,
  getActiveSession,
  isSessionExpired,
  refreshSession,
  requireActiveSession,
  signIn,
  signOut,
  type Session,
} from '../../lib/sessionLifecycle'

const NOW = 1_700_000_000_000

beforeEach(() => {
  redirectMock.mockClear()
})

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------
describe('signIn', () => {
  it('returns a session with the correct userId', () => {
    const session = signIn('user-1', 60_000, NOW)
    expect(session.userId).toBe('user-1')
  })

  it('sets expiresAt to now + ttlMs', () => {
    const session = signIn('user-1', 60_000, NOW)
    expect(session.expiresAt).toBe(NOW + 60_000)
  })

  it('creates distinct sessions for different users', () => {
    const a = signIn('user-a', 60_000, NOW)
    const b = signIn('user-b', 60_000, NOW)
    expect(a.userId).not.toBe(b.userId)
  })

  it('accepts a zero TTL (session immediately expired)', () => {
    const session = signIn('user-1', 0, NOW)
    expect(session.expiresAt).toBe(NOW)
    expect(isSessionExpired(session, NOW)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// createSession (deprecated alias for signIn)
// ---------------------------------------------------------------------------
describe('createSession (deprecated alias)', () => {
  it('produces the same result as signIn', () => {
    expect(createSession('user-1', 60_000, NOW)).toEqual(signIn('user-1', 60_000, NOW))
  })
})

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------
describe('signOut', () => {
  it('returns null representing a cleared session', () => {
    expect(signOut()).toBeNull()
  })

  it('calling signOut twice still returns null', () => {
    signOut()
    expect(signOut()).toBeNull()
  })

  it('getActiveSession returns null after signOut (caller-owns-storage pattern)', () => {
    const cleared = signOut()
    const getSession = vi.fn(() => cleared)
    expect(getActiveSession(getSession, NOW)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// isSessionExpired
// ---------------------------------------------------------------------------
describe('isSessionExpired', () => {
  it('returns false when session has not yet expired', () => {
    const session = signIn('user-1', 60_000, NOW)
    expect(isSessionExpired(session, NOW + 1_000)).toBe(false)
  })

  it('returns true when session has expired', () => {
    const session = signIn('user-1', 60_000, NOW)
    expect(isSessionExpired(session, NOW + 70_000)).toBe(true)
  })

  it('returns true when expiresAt === now (boundary: exact expiry is expired)', () => {
    const session: Session = { userId: 'user-1', expiresAt: NOW }
    expect(isSessionExpired(session, NOW)).toBe(true)
  })

  it('returns false one millisecond before expiry', () => {
    const session: Session = { userId: 'user-1', expiresAt: NOW + 1 }
    expect(isSessionExpired(session, NOW)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// refreshSession
// ---------------------------------------------------------------------------
describe('refreshSession', () => {
  it('extends expiresAt by ttlMs from now', () => {
    const original = signIn('user-1', 60_000, NOW)
    const refreshed = refreshSession(original, 120_000, NOW + 30_000)
    expect(refreshed.expiresAt).toBe(NOW + 30_000 + 120_000)
  })

  it('preserves the userId', () => {
    const original = signIn('user-42', 60_000, NOW)
    const refreshed = refreshSession(original, 60_000, NOW)
    expect(refreshed.userId).toBe('user-42')
  })

  it('returns a new object (immutable — does not mutate the original)', () => {
    const original = signIn('user-1', 60_000, NOW)
    const refreshed = refreshSession(original, 120_000, NOW)
    expect(refreshed).not.toBe(original)
    expect(original.expiresAt).toBe(NOW + 60_000) // unchanged
  })

  it('a refreshed session is no longer expired', () => {
    const original: Session = { userId: 'user-1', expiresAt: NOW - 1 }
    expect(isSessionExpired(original, NOW)).toBe(true)
    const refreshed = refreshSession(original, 60_000, NOW)
    expect(isSessionExpired(refreshed, NOW)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getActiveSession
// ---------------------------------------------------------------------------
describe('getActiveSession', () => {
  it('returns the session when it is still valid', () => {
    const session = signIn('user-1', 60_000, NOW)
    const getSession = vi.fn(() => session)
    expect(getActiveSession(getSession, NOW + 1_000)).toEqual(session)
  })

  it('returns null when the session reader returns null', () => {
    const getSession = vi.fn(() => null)
    expect(getActiveSession(getSession, NOW)).toBeNull()
  })

  it('returns null when the session is expired', () => {
    const session = signIn('user-1', 10, NOW)
    const getSession = vi.fn(() => session)
    expect(getActiveSession(getSession, NOW + 20)).toBeNull()
  })

  it('calls the session reader exactly once', () => {
    const session = signIn('user-1', 60_000, NOW)
    const getSession = vi.fn(() => session)
    getActiveSession(getSession, NOW)
    expect(getSession).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// requireActiveSession
// ---------------------------------------------------------------------------
describe('requireActiveSession', () => {
  it('returns the session when valid', () => {
    const session = signIn('user-1', 60_000, NOW)
    const getSession = vi.fn(() => session)
    expect(requireActiveSession(getSession, NOW + 1_000)).toEqual(session)
  })

  it('throws (redirect) when no session exists', () => {
    const getSession = vi.fn(() => null)
    expect(() => requireActiveSession(getSession, NOW)).toThrow()
    expect(redirectMock).toHaveBeenCalledWith({ to: '/login' })
  })

  it('throws (redirect) when session is expired', () => {
    const expired: Session = { userId: 'user-1', expiresAt: NOW - 1 }
    const getSession = vi.fn(() => expired)
    expect(() => requireActiveSession(getSession, NOW)).toThrow()
    expect(redirectMock).toHaveBeenCalledWith({ to: '/login' })
  })

  it('throws (redirect) when session expires at exactly now', () => {
    const session: Session = { userId: 'user-1', expiresAt: NOW }
    const getSession = vi.fn(() => session)
    expect(() => requireActiveSession(getSession, NOW)).toThrow()
    expect(redirectMock).toHaveBeenCalledWith({ to: '/login' })
  })

  it('redirectMock is cleared between tests (no cross-test bleed)', () => {
    // redirectMock.mockClear() runs in beforeEach — call count starts at 0
    expect(redirectMock).not.toHaveBeenCalled()
  })
})
