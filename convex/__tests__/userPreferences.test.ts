/**
 * Tests for convex/userPreferences.ts — IDOR security fix
 *
 * Verifies that:
 *  - getUserPreferences requires authentication
 *  - getUserPreferences derives userId from identity.subject, not caller args
 *  - setUserPreferences requires authentication
 *  - setUserPreferences derives userId from identity.subject, ignoring any injected arg
 */
import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock convex server — query/mutation just return the config object so we can
// extract and call the handler directly without a real Convex runtime.
// ---------------------------------------------------------------------------
vi.mock('../_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
}))

import * as userPrefsModule from '../userPreferences'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerExtractor = { handler: (...args: any[]) => Promise<any> }

const getHandler = (userPrefsModule.getUserPreferences as unknown as HandlerExtractor).handler
const setHandler = (userPrefsModule.setUserPreferences as unknown as HandlerExtractor).handler

// ---------------------------------------------------------------------------
// Helpers — build minimal ctx objects
// ---------------------------------------------------------------------------

function makeCtx(identity: { subject: string } | null, db?: object) {
  return {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(identity),
    },
    db: db ?? {
      query: vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      }),
      insert: vi.fn().mockResolvedValue('new-doc-id'),
      patch: vi.fn().mockResolvedValue(undefined),
    },
  }
}

// ---------------------------------------------------------------------------
// getUserPreferences
// ---------------------------------------------------------------------------
describe('getUserPreferences', () => {
  it('test_getUserPreferences_requires_auth — throws Unauthenticated when no identity', async () => {
    const ctx = makeCtx(null)
    await expect(getHandler(ctx)).rejects.toThrow('Unauthenticated')
  })

  it('test_getUserPreferences_uses_identity_subject — queries by identity.subject, not caller arg', async () => {
    const firstMock = vi.fn().mockResolvedValue({ userId: 'user-alice', defaultView: 'kanban' })
    const withIndexMock = vi.fn().mockReturnValue({ first: firstMock })
    const queryMock = vi.fn().mockReturnValue({ withIndex: withIndexMock })

    const ctx = makeCtx({ subject: 'user-alice' }, { query: queryMock, insert: vi.fn(), patch: vi.fn() })

    const result = await getHandler(ctx)

    // Should have queried userPreferences
    expect(queryMock).toHaveBeenCalledWith('userPreferences')

    // The withIndex callback should have been called — capture the predicate
    const predicateFn = withIndexMock.mock.calls[0][1]
    const fakeQ = { eq: vi.fn().mockReturnThis() }
    predicateFn(fakeQ)
    // Must eq on 'user-alice' (identity.subject), not any arbitrary value
    expect(fakeQ.eq).toHaveBeenCalledWith('userId', 'user-alice')

    expect(result).toEqual({ userId: 'user-alice', defaultView: 'kanban' })
  })
})

// ---------------------------------------------------------------------------
// setUserPreferences
// ---------------------------------------------------------------------------
describe('setUserPreferences', () => {
  const validArgs = {
    defaultView: 'kanban' as const,
    filterProject: undefined,
    filterAgent: undefined,
    notificationEnabled: true,
  }

  it('test_setUserPreferences_requires_auth — throws Unauthenticated when no identity', async () => {
    const ctx = makeCtx(null)
    await expect(setHandler(ctx, validArgs)).rejects.toThrow('Unauthenticated')
  })

  it('test_setUserPreferences_ignores_caller_userId — inserts with identity.subject, not injected arg', async () => {
    const insertMock = vi.fn().mockResolvedValue('new-pref-id')
    const firstMock = vi.fn().mockResolvedValue(null) // no existing prefs
    const withIndexMock = vi.fn().mockReturnValue({ first: firstMock })
    const queryMock = vi.fn().mockReturnValue({ withIndex: withIndexMock })

    const ctx = makeCtx({ subject: 'user-alice' }, {
      query: queryMock,
      insert: insertMock,
      patch: vi.fn(),
    })

    // Even if a caller tried to inject a foreign userId (old API style), it is NOT in args anymore.
    // The handler must use identity.subject ('user-alice') for the insert.
    const result = await setHandler(ctx, validArgs)

    expect(insertMock).toHaveBeenCalledWith('userPreferences', expect.objectContaining({
      userId: 'user-alice', // must be identity.subject
    }))
    // Must NOT insert with any other userId
    expect(insertMock.mock.calls[0][1].userId).toBe('user-alice')
    expect(result).toBe('new-pref-id')
  })

  it('patches existing prefs using identity.subject, never a foreign id', async () => {
    const existingDoc = { _id: 'doc-123', userId: 'user-alice', defaultView: 'list' }
    const patchMock = vi.fn().mockResolvedValue(undefined)
    const firstMock = vi.fn().mockResolvedValue(existingDoc)
    const withIndexMock = vi.fn().mockReturnValue({ first: firstMock })
    const queryMock = vi.fn().mockReturnValue({ withIndex: withIndexMock })

    const ctx = makeCtx({ subject: 'user-alice' }, {
      query: queryMock,
      insert: vi.fn(),
      patch: patchMock,
    })

    const result = await setHandler(ctx, { ...validArgs, defaultView: 'workload' as const })

    // Should patch the existing doc, NOT insert
    expect(patchMock).toHaveBeenCalledWith('doc-123', expect.objectContaining({
      defaultView: 'workload',
    }))
    expect(result).toBe('doc-123')
  })
})
