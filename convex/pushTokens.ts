import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

type PushTokenArgs = {
  userId: string
  deviceId: string
  token: string
  platform: 'ios'
}

type DeviceArgs = { deviceId: string }
type UserArgs = { userId: string }
type IndexField = 'userId' | 'deviceId'
type IndexName = 'by_user' | 'by_device'

type PushTokenRecord = {
  _id: unknown
}

type PushTokenQuery = {
  withIndex: (
    indexName: IndexName,
    indexFn: (q: { eq: (field: IndexField, value: string) => unknown }) => unknown
  ) => {
    collect: () => Promise<unknown[]>
    first: () => Promise<PushTokenRecord | null>
  }
}

function getPushTokensQuery(ctx: { db: { query: (table: string) => unknown } }): PushTokenQuery {
  return ctx.db.query('pushTokens') as PushTokenQuery
}

function requireArgs<T>(args: T | undefined): T {
  if (!args) {
    throw new Error('Missing args')
  }
  return args
}

/**
 * Get all push tokens for a specific user
 */
export const getUserTokens = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const input = requireArgs(args as UserArgs | undefined)
    return await getPushTokensQuery(ctx)
      .withIndex('by_user', (q) => q.eq('userId', input.userId))
      .collect()
  },
})

/**
 * Get push token by device ID
 */
export const getDeviceToken = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const input = requireArgs(args as DeviceArgs | undefined)
    return await getPushTokensQuery(ctx)
      .withIndex('by_device', (q) => q.eq('deviceId', input.deviceId))
      .first()
  },
})

/**
 * Register or update a push token
 * 
 * Upserts a push token for a device. If the device already has a token,
 * updates it with the new token and lastUsedAt timestamp.
 */
export const registerToken = mutation({
  args: {
    userId: v.string(),
    deviceId: v.string(),
    token: v.string(),
    platform: v.literal('ios'),
  },
  handler: async (ctx, args) => {
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const input = requireArgs(args as PushTokenArgs | undefined)
    const now = Date.now()
    const existing = await getPushTokensQuery(ctx)
      .withIndex('by_device', (q) => q.eq('deviceId', input.deviceId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        userId: input.userId,
        deviceId: input.deviceId,
        token: input.token,
        platform: input.platform,
        lastUsedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('pushTokens', {
      userId: input.userId,
      deviceId: input.deviceId,
      token: input.token,
      platform: input.platform,
      createdAt: now,
      lastUsedAt: now,
    })
  },
})

/**
 * Delete a push token (e.g., when user logs out)
 */
export const deleteToken = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const input = requireArgs(args as DeviceArgs | undefined)
    const token = await getPushTokensQuery(ctx)
      .withIndex('by_device', (q) => q.eq('deviceId', input.deviceId))
      .first()

    if (!token) {
      return { deleted: false }
    }

    await ctx.db.delete(token._id)
    return { deleted: true }
  },
})

/**
 * Update lastUsedAt timestamp for a token
 * 
 * Call this when successfully sending a push notification
 */
export const updateLastUsed = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const input = requireArgs(args as DeviceArgs | undefined)
    const token = await getPushTokensQuery(ctx)
      .withIndex('by_device', (q) => q.eq('deviceId', input.deviceId))
      .first()

    if (!token) {
      return { updated: false }
    }

    await ctx.db.patch(token._id, { lastUsedAt: Date.now() })
    return { updated: true }
  },
})
