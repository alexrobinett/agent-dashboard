import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import { api } from './_generated/api'

export const notifyTaskDone = internalMutation({
  args: {
    taskId: v.id('tasks'),
    agentName: v.string(),
  },
  handler: async (ctx: any, args: { taskId: string; agentName: string }) => {
    const tokens = await (ctx as any).runQuery(api.pushTokens.getUserTokens, {
      userId: args.agentName,
    })

    if (!tokens || tokens.length === 0) {
      return { queued: false }
    }

    await ctx.db.insert('activityLog', {
      type: 'push_queued',
      taskId: args.taskId,
      agentName: args.agentName,
      timestamp: Date.now(),
    })

    return { queued: true }
  },
})
