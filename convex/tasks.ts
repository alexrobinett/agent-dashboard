import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

/** A single row in the workload aggregation: one (agent, status) combination. */
export type WorkloadEntry = {
  agent: string
  status: string
  count: number
}

/** Pure aggregation: groups tasks by (agent, status) → flat WorkloadEntry[]. */
export function aggregateWorkloadEntries(
  tasks: Array<{ assignedAgent?: string; status?: string; priority?: string; project?: string }>,
  filters?: { project?: string; priority?: string },
): WorkloadEntry[] {
  let filtered = tasks
  if (filters?.project) {
    const proj = filters.project
    filtered = filtered.filter(t => t.project === proj)
  }
  if (filters?.priority) {
    const pri = filters.priority
    filtered = filtered.filter(t => t.priority === pri)
  }

  const counts: Record<string, number> = {}
  for (const task of filtered) {
    const agent = task.assignedAgent || 'unassigned'
    const status = task.status || 'planning'
    const key = `${agent}::${status}`
    counts[key] = (counts[key] || 0) + 1
  }

  const entries: WorkloadEntry[] = []
  for (const [key, count] of Object.entries(counts)) {
    const [agent, status] = key.split('::')
    entries.push({ agent, status, count })
  }
  return entries
}

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

/** Pure aggregation logic for workload computation — exported for testability. */
export function aggregateWorkload(
  tasks: Array<{ assignedAgent?: string; status?: string; priority?: string }>,
): Record<string, { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> }> {
  const workload: Record<string, {
    total: number
    byStatus: Record<string, number>
    byPriority: Record<string, number>
  }> = {}

  for (const task of tasks) {
    const agent = task.assignedAgent || 'unassigned'
    const status = task.status || 'planning'
    const priority = task.priority || 'normal'

    if (!workload[agent]) {
      workload[agent] = {
        total: 0,
        byStatus: {},
        byPriority: {},
      }
    }

    workload[agent].total += 1
    workload[agent].byStatus[status] = (workload[agent].byStatus[status] || 0) + 1
    workload[agent].byPriority[priority] = (workload[agent].byPriority[priority] || 0) + 1
  }

  return workload
}

export const getWorkload = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query('tasks').order('desc').take(500)
    return aggregateWorkload(tasks)
  },
})

export const getWorkloadByAgentStatus = query({
  args: {
    project: v.optional(v.string()),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tasks = await ctx.db.query('tasks').order('desc').take(500)
    return aggregateWorkloadEntries(tasks, {
      project: args?.project,
      priority: args?.priority,
    })
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

export const getById = query({
  args: {
    id: v.id('tasks'),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args!.id)
    return task
  },
})

export const create = mutation({
  args: {
    title: v.string(),
    priority: v.string(),
    project: v.string(),
    notes: v.optional(v.string()),
    assignedAgent: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate priority
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    if (!validPriorities.includes(args!.priority as unknown as string)) {
      throw new Error(`Invalid priority: ${args!.priority}. Must be one of: ${validPriorities.join(', ')}`)
    }
    
    // Validate status if provided
    if (args!.status) {
      const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
      if (!validStatuses.includes(args!.status as unknown as string)) {
        throw new Error(`Invalid status: ${args!.status}. Must be one of: ${validStatuses.join(', ')}`)
      }
    }
    
    // Create task with required fields
    const taskId = await ctx.db.insert('tasks', {
      title: args!.title,
      priority: args!.priority,
      project: args!.project,
      notes: args!.notes,
      assignedAgent: args!.assignedAgent || 'unassigned',
      createdBy: args!.createdBy || 'api',
      status: args!.status || 'planning',
      createdAt: Date.now(),
    })
    
    return { id: taskId }
  },
})

export const update = mutation({
  args: {
    id: v.id('tasks'),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    assignedAgent: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get existing task
    const task = await ctx.db.get(args!.id)
    if (!task) {
      throw new Error(`Task not found: ${args!.id}`)
    }
    
    // Validate status if provided
    if (args!.status) {
      const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
      if (!validStatuses.includes(args!.status as unknown as string)) {
        throw new Error(`Invalid status: ${args!.status}. Must be one of: ${validStatuses.join(', ')}`)
      }
    }
    
    // Validate priority if provided
    if (args!.priority) {
      const validPriorities = ['low', 'normal', 'high', 'urgent']
      if (!validPriorities.includes(args!.priority as unknown as string)) {
        throw new Error(`Invalid priority: ${args!.priority}. Must be one of: ${validPriorities.join(', ')}`)
      }
    }
    
    // Build update object with only provided fields
    const updates: Record<string, unknown> = {}
    if (args!.status !== undefined) updates.status = args!.status
    if (args!.priority !== undefined) updates.priority = args!.priority
    if (args!.assignedAgent !== undefined) updates.assignedAgent = args!.assignedAgent
    if (args!.notes !== undefined) updates.notes = args!.notes
    
    // Update task
    await ctx.db.patch(args!.id, updates)
    
    return { success: true }
  },
})
