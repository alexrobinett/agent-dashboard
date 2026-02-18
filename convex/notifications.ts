import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { api } from './_generated/api'
import type { Id } from './_generated/dataModel'

export const notifyTaskDone = internalMutation({
  args: {
    taskId: v.id('tasks'),
    agentName: v.string(),
  },
  handler: async (
    ctx: {
      runQuery: (query: unknown, args: { userId: string }) => Promise<unknown[] | null | undefined>
      db: { insert: (table: string, doc: Record<string, unknown>) => Promise<unknown> }
    },
    args: { taskId: Id<'tasks'>; agentName: string },
  ) => {
    const tokens = await ctx.runQuery(api.pushTokens.getUserTokens, {
      userId: args.agentName,
    })

    if (!tokens || tokens.length === 0) {
      return { queued: false }
    }

    await ctx.db.insert('activityLog', {
      type: 'push_queued',
      taskId: args.taskId,
      actor: 'system',
      actorType: 'system',
      action: 'updated',
      metadata: {
        notes: `Queued push notification for ${args.agentName}`,
      },
      timestamp: Date.now(),
    })

    return { queued: true }
  },
})
