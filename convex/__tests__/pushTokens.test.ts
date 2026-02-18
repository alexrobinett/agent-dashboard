import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Doc, Id } from '../_generated/dataModel'

vi.mock('../_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
}))

import * as pushTokenModule from '../pushTokens'

type PushTokenDoc = Doc<'pushTokens'>
type PushTokenId = Id<'pushTokens'>
type PushTokenFields = Omit<PushTokenDoc, '_id' | '_creationTime'>
type EqField = 'userId' | 'deviceId'

type HandlerConfig<TArgs, TResult> = {
  handler: (ctx: MockCtx, args: TArgs) => Promise<TResult>
}

const getUserTokensHandler = (
  pushTokenModule.getUserTokens as unknown as HandlerConfig<{ userId: string }, PushTokenDoc[]>
).handler
const getDeviceTokenHandler = (
  pushTokenModule.getDeviceToken as unknown as HandlerConfig<{ deviceId: string }, PushTokenDoc | null>
).handler
const registerTokenHandler = (
  pushTokenModule.registerToken as unknown as HandlerConfig<
    {
      userId: string
      deviceId: string
      token: string
      platform: 'ios'
    },
    PushTokenId
  >
).handler
const deleteTokenHandler = (
  pushTokenModule.deleteToken as unknown as HandlerConfig<{ deviceId: string }, { deleted: boolean }>
).handler
const updateLastUsedHandler = (
  pushTokenModule.updateLastUsed as unknown as HandlerConfig<{ deviceId: string }, { updated: boolean }>
).handler

type IndexCall = {
  table: 'pushTokens'
  indexName: 'by_user' | 'by_device'
  eqCalls: Array<{ field: EqField; value: string }>
}

type MockCtx = {
  db: {
    query: (table: 'pushTokens') => {
      withIndex: (
        indexName: 'by_user' | 'by_device',
        indexFn: (q: { eq: (field: EqField, value: string) => { eq: (field: EqField, value: string) => unknown } }) => unknown
      ) => {
        collect: () => Promise<PushTokenDoc[]>
        first: () => Promise<PushTokenDoc | null>
      }
    }
    insert: (table: 'pushTokens', doc: PushTokenFields) => Promise<PushTokenId>
    patch: (id: PushTokenId, fields: Partial<PushTokenFields>) => Promise<void>
    delete: (id: PushTokenId) => Promise<void>
  }
  _tokens: PushTokenDoc[]
  _indexCalls: IndexCall[]
  _patches: Array<{ id: PushTokenId; fields: Partial<PushTokenFields> }>
  _deletes: PushTokenId[]
  _inserts: PushTokenFields[]
}

function makeToken(overrides: Partial<PushTokenFields> & { _id: PushTokenId }): PushTokenDoc {
  const { _id, ...rest } = overrides
  return {
    _id,
    _creationTime: Date.now(),
    userId: 'user-1',
    deviceId: 'device-1',
    token: 'token-1',
    platform: 'ios',
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    ...rest,
  }
}

function makeCtx(initialTokens: PushTokenDoc[]): MockCtx {
  const tokens = [...initialTokens]
  const indexCalls: IndexCall[] = []
  const patches: Array<{ id: PushTokenId; fields: Partial<PushTokenFields> }> = []
  const deletes: PushTokenId[] = []
  const inserts: PushTokenFields[] = []
  let nextId = 100

  return {
    db: {
      query: (table: 'pushTokens') => ({
        withIndex: (indexName, indexFn) => {
          const eqCalls: Array<{ field: EqField; value: string }> = []
          const chain = {
            eq: (field: EqField, value: string) => {
              eqCalls.push({ field, value })
              return chain
            },
          }

          indexFn(chain)
          indexCalls.push({ table, indexName, eqCalls })

          let filtered = [...tokens]
          for (const call of eqCalls) {
            filtered = filtered.filter((token) => token[call.field] === call.value)
          }

          return {
            collect: async () => filtered,
            first: async () => filtered[0] ?? null,
          }
        },
      }),
      insert: async (_table: 'pushTokens', doc: PushTokenFields) => {
        const id = `token-${nextId++}` as PushTokenId
        inserts.push(doc)
        tokens.push({
          _id: id,
          _creationTime: Date.now(),
          ...doc,
        })
        return id
      },
      patch: async (id: PushTokenId, fields: Partial<PushTokenFields>) => {
        patches.push({ id, fields })
        const token = tokens.find((t) => t._id === id)
        if (token) {
          Object.assign(token, fields)
        }
      },
      delete: async (id: PushTokenId) => {
        deletes.push(id)
        const index = tokens.findIndex((t) => t._id === id)
        if (index !== -1) {
          tokens.splice(index, 1)
        }
      },
    },
    _tokens: tokens,
    _indexCalls: indexCalls,
    _patches: patches,
    _deletes: deletes,
    _inserts: inserts,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('pushTokens queries', () => {
  it('getUserTokens uses by_user index and returns matching rows', async () => {
    const ctx = makeCtx([
      makeToken({ _id: 'a' as PushTokenId, userId: 'user-1', deviceId: 'd1' }),
      makeToken({ _id: 'b' as PushTokenId, userId: 'user-2', deviceId: 'd2' }),
      makeToken({ _id: 'c' as PushTokenId, userId: 'user-1', deviceId: 'd3' }),
    ])

    const result = await getUserTokensHandler(ctx, { userId: 'user-1' })

    expect(result).toHaveLength(2)
    expect(result.map((token) => token._id)).toEqual(['a', 'c'])
    expect(ctx._indexCalls).toHaveLength(1)
    expect(ctx._indexCalls[0].indexName).toBe('by_user')
    expect(ctx._indexCalls[0].eqCalls).toEqual([{ field: 'userId', value: 'user-1' }])
  })

  it('getDeviceToken uses by_device index and returns null when missing', async () => {
    const ctx = makeCtx([
      makeToken({ _id: 'a' as PushTokenId, userId: 'user-1', deviceId: 'd1' }),
    ])

    const found = await getDeviceTokenHandler(ctx, { deviceId: 'd1' })
    const missing = await getDeviceTokenHandler(ctx, { deviceId: 'does-not-exist' })

    expect(found?._id).toBe('a')
    expect(missing).toBeNull()
    expect(ctx._indexCalls).toHaveLength(2)
    expect(ctx._indexCalls[0].indexName).toBe('by_device')
    expect(ctx._indexCalls[1].indexName).toBe('by_device')
  })
})

describe('registerToken mutation', () => {
  it('inserts when device does not exist', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const ctx = makeCtx([])

    const id = await registerTokenHandler(ctx, {
      userId: 'user-1',
      deviceId: 'device-new',
      token: 'token-new',
      platform: 'ios',
    })

    expect(id).toBe('token-100')
    expect(ctx._indexCalls).toHaveLength(1)
    expect(ctx._indexCalls[0].indexName).toBe('by_device')
    expect(ctx._patches).toHaveLength(0)
    expect(ctx._inserts).toEqual([
      {
        userId: 'user-1',
        deviceId: 'device-new',
        token: 'token-new',
        platform: 'ios',
        createdAt: 1_700_000_000_000,
        lastUsedAt: 1_700_000_000_000,
      },
    ])
  })

  it('patches existing device and does not insert duplicate', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
    const ctx = makeCtx([
      makeToken({
        _id: 'existing' as PushTokenId,
        userId: 'old-user',
        deviceId: 'device-1',
        token: 'old-token',
        createdAt: 1_600_000_000_000,
        lastUsedAt: 1_600_000_000_000,
      }),
    ])

    const id = await registerTokenHandler(ctx, {
      userId: 'new-user',
      deviceId: 'device-1',
      token: 'new-token',
      platform: 'ios',
    })

    expect(id).toBe('existing')
    expect(ctx._inserts).toHaveLength(0)
    expect(ctx._patches).toEqual([
      {
        id: 'existing',
        fields: {
          userId: 'new-user',
          deviceId: 'device-1',
          token: 'new-token',
          platform: 'ios',
          lastUsedAt: 1_800_000_000_000,
        },
      },
    ])
    expect(ctx._tokens[0].createdAt).toBe(1_600_000_000_000)
  })
})

describe('deleteToken and updateLastUsed mutations', () => {
  it('deleteToken removes row by device and returns status', async () => {
    const ctx = makeCtx([
      makeToken({ _id: 'a' as PushTokenId, deviceId: 'd1' }),
    ])

    const deleted = await deleteTokenHandler(ctx, { deviceId: 'd1' })
    const missing = await deleteTokenHandler(ctx, { deviceId: 'missing' })

    expect(deleted).toEqual({ deleted: true })
    expect(missing).toEqual({ deleted: false })
    expect(ctx._deletes).toEqual(['a'])
    expect(ctx._indexCalls.map((call) => call.indexName)).toEqual(['by_device', 'by_device'])
  })

  it('updateLastUsed patches timestamp when token exists', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_900_000_000_000)
    const ctx = makeCtx([
      makeToken({ _id: 'a' as PushTokenId, deviceId: 'd1', lastUsedAt: 100 }),
    ])

    const updated = await updateLastUsedHandler(ctx, { deviceId: 'd1' })
    const missing = await updateLastUsedHandler(ctx, { deviceId: 'missing' })

    expect(updated).toEqual({ updated: true })
    expect(missing).toEqual({ updated: false })
    expect(ctx._patches).toContainEqual({
      id: 'a',
      fields: { lastUsedAt: 1_900_000_000_000 },
    })
    expect(ctx._indexCalls.map((call) => call.indexName)).toEqual(['by_device', 'by_device'])
  })
})
