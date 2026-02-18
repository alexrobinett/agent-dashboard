import { describe, expect, it, vi } from 'vitest'

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
  requireActiveSession,
  signIn,
  signOut,
  type Session,
} from '../../lib/sessionLifecycle'

describe('session lifecycle', () => {
  it('sign-in creates a valid session and reads it via mocked getSession', () => {
    const now = 1_700_000_000_000
    const session = signIn('user-123', 60_000, now)
    const getSession = vi.fn(() => session)

    expect(session.userId).toBe('user-123')
    expect(session.expiresAt).toBe(now + 60_000)
    expect(getActiveSession(getSession, now + 1_000)).toEqual(session)
    expect(getSession).toHaveBeenCalledTimes(1)
  })

  it('sign-out clears the active session', () => {
    const cleared = signOut()
    const getSession = vi.fn(() => cleared)

    expect(cleared).toBeNull()
    expect(getActiveSession(getSession)).toBeNull()
    expect(getSession).toHaveBeenCalledTimes(1)
  })

  it('expired session is treated as unauthenticated', () => {
    const now = 1_700_000_000_000
    const expiredSession: Session = createSession('user-123', 10, now)
    const getSession = vi.fn(() => expiredSession)

    expect(isSessionExpired(expiredSession, now + 20)).toBe(true)
    expect(getActiveSession(getSession, now + 20)).toBeNull()
    expect(getSession).toHaveBeenCalledTimes(1)
  })

  it('protected route redirects to login when no active session exists', () => {
    const getSession = vi.fn(() => null)

    expect(() => requireActiveSession(getSession)).toThrow()
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(redirectMock).toHaveBeenCalledWith({ to: '/login' })
  })
})
