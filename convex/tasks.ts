import { query } from './_generated/server'
import { v } from 'convex/values'

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

export const listFiltered = query({
  args: {
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    project: v.optional(v.string()),
    assignedAgent: v.optional(v.string()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = typeof args?.limit === 'number' ? args.limit : 50
    const offset = typeof args?.offset === 'number' ? args.offset : 0
    
    // Fetch more tasks than needed to handle filtering
    const allTasks = await ctx.db.query('tasks').order('desc').take(1000)
    
    // Apply filters
    let filtered = allTasks
    
    if (args?.status) {
      const status = args.status
      filtered = filtered.filter(task => task.status === status)
    }
    
    if (args?.priority) {
      const priority = args.priority
      filtered = filtered.filter(task => task.priority === priority)
    }
    
    if (args?.project) {
      const project = args.project
      filtered = filtered.filter(task => task.project === project)
    }
    
    if (args?.assignedAgent) {
      const assignedAgent = args.assignedAgent
      filtered = filtered.filter(task => task.assignedAgent === assignedAgent)
    }
    
    // Apply pagination
    const paginated = filtered.slice(offset, offset + limit)
    
    return {
      tasks: paginated,
      total: filtered.length,
      limit,
      offset,
      hasMore: offset + limit < filtered.length,
    }
  },
})
