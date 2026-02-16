import { query } from './_generated/server'

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query('tasks').order('desc').take(100)
  },
})

export const getByStatus = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query('tasks').order('desc').take(200)
    
    const grouped: Record<string, typeof tasks> = {
      planning: [],
      ready: [],
      in_progress: [],
      in_review: [],
      done: [],
      blocked: [],
    }
    
    for (const task of tasks) {
      const status = task.status || 'planning'
      if (grouped[status]) {
        grouped[status].push(task)
      }
    }
    
    return grouped
  },
})

export const getWorkload = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query('tasks').order('desc').take(500)
    
    // Aggregate tasks by agent
    const workload: Record<string, {
      total: number
      byStatus: Record<string, number>
      byPriority: Record<string, number>
    }> = {}
    
    for (const task of tasks) {
      const agent = task.assignedAgent || 'unassigned'
      const status = task.status || 'planning'
      const priority = task.priority || 'normal'
      
      // Initialize agent entry if doesn't exist
      if (!workload[agent]) {
        workload[agent] = {
          total: 0,
          byStatus: {},
          byPriority: {},
        }
      }
      
      // Increment counts
      workload[agent].total += 1
      workload[agent].byStatus[status] = (workload[agent].byStatus[status] || 0) + 1
      workload[agent].byPriority[priority] = (workload[agent].byPriority[priority] || 0) + 1
    }
    
    return workload
  },
})
