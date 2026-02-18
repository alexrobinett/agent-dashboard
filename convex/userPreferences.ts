import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

/**
 * Get user preferences by userId
 * 
 * Note: This uses the by_user index defined in schema.ts
 */
export const getUserPreferences = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const input = args as any
    return await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', input.userId))
      .first()
  },
})

/**
 * Create or update user preferences
 * 
 * Upserts preferences for a given user
 */
export const setUserPreferences = mutation({
  args: {
    userId: v.string(),
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
    const input = args as any
    const now = Date.now()
    const existing = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', input.userId))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        defaultView: input.defaultView,
        filterProject: input.filterProject,
        filterAgent: input.filterAgent,
        notificationEnabled: input.notificationEnabled,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('userPreferences', {
      userId: input.userId,
      defaultView: input.defaultView,
      filterProject: input.filterProject,
      filterAgent: input.filterAgent,
      notificationEnabled: input.notificationEnabled,
      createdAt: now,
      updatedAt: now,
    })
  },
})
