import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

/**
 * Get user preferences for the currently authenticated user.
 *
 * [security] userId is derived from the auth identity (identity.subject),
 * never from caller-supplied arguments. This prevents IDOR — any authenticated
 * user can only read their own preferences.
 */
export const getUserPreferences = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    return await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', identity.subject))
      .first()
  },
})

/**
 * Create or update user preferences for the currently authenticated user.
 *
 * [security] userId is derived from the auth identity (identity.subject),
 * never from caller-supplied arguments. This prevents IDOR — authenticated
 * user A cannot overwrite user B's preferences by injecting a foreign userId.
 */
export const setUserPreferences = mutation({
  args: {
    defaultView: v.union(
      v.literal('kanban'),
      v.literal('list'),
      v.literal('workload')
    ),
    filterProject: v.optional(v.string()),
    filterAgent: v.optional(v.string()),
    notificationEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { defaultView, filterProject, filterAgent, notificationEnabled } = args!
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const userId = identity.subject // Always use auth identity, never caller-supplied
    const now = Date.now()
    const existing = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        defaultView,
        filterProject,
        filterAgent,
        notificationEnabled,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('userPreferences', {
      userId,
      defaultView,
      filterProject,
      filterAgent,
      notificationEnabled,
      createdAt: now,
      updatedAt: now,
    })
  },
})
