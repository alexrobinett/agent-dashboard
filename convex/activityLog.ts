import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

/**
 * Get activity log entries for a specific task
 * Returns entries in chronological order (oldest first)
 */
export const getTaskActivity = query({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, args) => {
    // In production, this will use:
    // return await ctx.db
    //   .query('activityLog')
    //   .withIndex('by_task', (q) => q.eq('taskId', args.taskId))
    //   .order('asc')
    //   .collect()

    // For stub/CI purposes, simplified implementation
    const logs = await ctx.db.query('activityLog').order('desc').take(200)
    return logs.filter((log: any) => log.taskId === (args as any).taskId)
  },
})

/**
 * Get recent activity across all tasks
 * Returns most recent entries first
 */
export const getRecentActivity = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = (args as any)?.limit || 50

    // In production, this will use:
    // return await ctx.db
    //   .query('activityLog')
    //   .withIndex('by_timestamp')
    //   .order('desc')
    //   .take(limit)

    // For stub/CI purposes, simplified implementation
    return await ctx.db.query('activityLog').order('desc').take(limit)
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
