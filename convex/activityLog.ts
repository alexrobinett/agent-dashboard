import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

type QueryCtx = { db: { query: (table: 'activityLog') => any } }

function maybeWithIndex(queryRef: any, indexName: string, indexFn?: (q: any) => any) {
  const withIndex = (queryRef as { withIndex?: (name: string, fn?: (q: any) => any) => any }).withIndex
  if (typeof withIndex === 'function') {
    return { queryRef: withIndex.call(queryRef, indexName, indexFn), usedIndex: true }
  }
  return { queryRef, usedIndex: false }
}

/**
 * Get activity log entries for a specific task
 * Returns entries in chronological order (oldest first)
 */
export const getTaskActivity = query({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, args) => {
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const input = args as any
    const { queryRef, usedIndex } = maybeWithIndex(
      (ctx as QueryCtx).db.query('activityLog'),
      'by_task',
      (q) => q.eq('taskId', input.taskId),
    )
    const entries = await queryRef.order('asc').collect()
    return usedIndex ? entries : entries.filter((entry: any) => entry.taskId === input.taskId)
  },
})

/**
 * Get recent activity across all tasks
 * Returns most recent entries first
 */
export const getRecentActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const input = args as any
    const limit = input.limit ?? 50
    const { queryRef } = maybeWithIndex((ctx as QueryCtx).db.query('activityLog'), 'by_timestamp')
    return await queryRef.order('desc').take(limit)
  },
})

/**
 * Log an activity entry
 * 
 * This should be called whenever a significant action occurs on a task
 */
export const logActivity = mutation({
  args: {
    taskId: v.id('tasks'),
    actor: v.string(),
    actorType: v.union(
      v.literal('agent'),
      v.literal('user'),
      v.literal('system')
    ),
    action: v.union(
      v.literal('created'),
      v.literal('claimed'),
      v.literal('started'),
      v.literal('completed'),
      v.literal('updated'),
      v.literal('blocked'),
      v.literal('handed_off'),
      v.literal('status_changed'),
      v.literal('deleted'),
      v.literal('assigned'),
      v.literal('commented'),
      v.literal('priority_changed')
    ),
    metadata: v.optional(
      v.object({
        fromStatus: v.optional(v.string()),
        toStatus: v.optional(v.string()),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const a = args as any

    return await ctx.db.insert('activityLog', {
      taskId: a.taskId,
      actor: a.actor,
      actorType: a.actorType,
      action: a.action,
      metadata: a.metadata,
      timestamp: Date.now(),
    })
  },
})
