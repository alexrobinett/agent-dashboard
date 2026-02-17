import { query, mutation } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { v } from 'convex/values'

// ─── Shared Type Validators ───

const STATUS_VALUES = v.union(
  v.literal('planning'),
  v.literal('ready'),
  v.literal('in_progress'),
  v.literal('in_review'),
  v.literal('done'),
  v.literal('blocked'),
  v.literal('cancelled'),
  // Legacy compat
  v.literal('pending'),
  v.literal('active'),
)

const PRIORITY_VALUES = v.union(
  v.literal('low'),
  v.literal('normal'),
  v.literal('high'),
  v.literal('urgent'),
)

// ─── Helper Functions ───

/** Map legacy statuses to new ones for display */
export function normalizeStatus(status: string): string {
  if (status === 'pending') return 'ready'
  if (status === 'active') return 'in_progress'
  return status
}

/** Valid state transitions (from → allowed to) */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  planning:    ['ready', 'cancelled', 'blocked'],
  ready:       ['in_progress', 'planning', 'cancelled', 'blocked'],
  in_progress: ['in_review', 'done', 'blocked', 'ready', 'cancelled'],
  in_review:   ['done', 'in_progress', 'ready', 'blocked', 'cancelled'],
  blocked:     ['ready', 'planning', 'cancelled'],
  done:        [], // terminal
  cancelled:   [], // terminal
  // Legacy
  pending:     ['ready', 'in_progress', 'cancelled'],
  active:      ['in_review', 'done', 'blocked', 'ready', 'cancelled'],
}

export function isValidTransition(from: string, to: string): boolean {
  const allowed = VALID_TRANSITIONS[from]
  if (!allowed) return true // Unknown status, allow (safety valve)
  return allowed.includes(to)
}

/** System token verification using Convex runtime env. */
function verifySystemToken(_token: string | undefined): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  const expected = env?.SYSTEM_TOKEN ?? env?.CONVEX_SYSTEM_TOKEN
  if (!expected) {
    console.error('SYSTEM_TOKEN/CONVEX_SYSTEM_TOKEN is not configured in Convex env')
    return false
  }
  if (!_token) return false
  return _token === expected
}

const DEFAULT_LEASE_TTL_MS = 30 * 60 * 1000
const MAX_DEPENDENCY_DEPTH = 25
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

export function sanitizeText(value: string, maxLen = 4000): string {
  const cleaned = value.replace(CONTROL_CHARS_RE, ' ')
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned
}

export function sanitizeOptionalText(value: string | undefined, maxLen = 4000): string | undefined {
  if (value === undefined) return undefined
  return sanitizeText(value, maxLen)
}

async function validateDependencies(
  ctx: { db: { get: (id: any) => Promise<any> } },
  taskIdForCycle: string,
  dependsOn: string[] | undefined,
) {
  if (!dependsOn || dependsOn.length === 0) return

  const invalidIds: string[] = []
  for (const depId of dependsOn) {
    const depTask = await ctx.db.get(depId as any)
    if (!depTask) invalidIds.push(depId)
  }
  if (invalidIds.length > 0) {
    throw new Error(`Invalid dependency IDs: ${invalidIds.join(', ')}`)
  }

  for (const rootDepId of dependsOn) {
    type Node = { id: string; path: Set<string>; depth: number }
    const stack: Node[] = [{ id: rootDepId, path: new Set([taskIdForCycle]), depth: 0 }]

    while (stack.length > 0) {
      const node = stack.pop()!

      if (node.id === taskIdForCycle || node.path.has(node.id)) {
        throw new Error(`Circular dependency detected involving ${taskIdForCycle} and ${node.id}`)
      }
      if (node.depth > MAX_DEPENDENCY_DEPTH) {
        throw new Error(`Dependency graph too deep (>${MAX_DEPENDENCY_DEPTH}) near ${node.id}`)
      }

      const depTask = await ctx.db.get(node.id as any)
      if (!depTask?.dependsOn || depTask.dependsOn.length === 0) continue

      const nextPath = new Set(node.path)
      nextPath.add(node.id)
      for (const next of depTask.dependsOn) {
        stack.push({ id: String(next), path: nextPath, depth: node.depth + 1 })
      }
    }
  }
}

// ─── Workload Aggregation Helpers (exported for testability) ───

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

// ═══════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════

// ─── Dashboard Queries (original) ───

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

export const getById = query({
  args: {
    id: v.id('tasks'),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args!.id)
    return task
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
    
    const allTasks = await ctx.db.query('tasks').order('desc').take(1000)
    
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

export const getWorkloadByAgentStatus = query({
  args: {
    project: v.optional(v.string()),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tasks = await ctx.db.query('tasks').order('desc').take(500)
    return aggregateWorkloadEntries(tasks, {
      project: args?.project as string | undefined,
      priority: args?.priority as string | undefined,
    })
  },
})

// ─── Agent Queries (from clawd) ───

export const listTasks = query({
  args: {
    status: v.optional(v.string()),
    agent: v.optional(v.string()),
    project: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, _args) => {

      const {  status, agent, project, limit  } = _args as any
    let tasks

    if (project) {
      tasks = await ctx.db
        .query('tasks')
        .withIndex('by_project', (q) => q.eq('project', project))
        .order('desc')
        .take(limit ?? 100)
      if (status) tasks = tasks.filter((t) => t.status === status)
      if (agent) tasks = tasks.filter((t) => t.assignedAgent === agent)
    } else if (status && agent) {
      tasks = await ctx.db
        .query('tasks')
        .withIndex('by_status_and_agent', (q) =>
          q.eq('status', status as any).eq('assignedAgent', agent),
        )
        .order('desc')
        .take(limit ?? 100)
    } else if (status) {
      tasks = await ctx.db
        .query('tasks')
        .withIndex('by_status', (q) => q.eq('status', status as any))
        .order('desc')
        .take(limit ?? 100)
    } else if (agent) {
      tasks = await ctx.db
        .query('tasks')
        .withIndex('by_agent', (q) => q.eq('assignedAgent', agent))
        .order('desc')
        .take(limit ?? 100)
    } else {
      tasks = await ctx.db
        .query('tasks')
        .order('desc')
        .take(limit ?? 100)
    }

    return tasks
  },
})

export const getTask = query({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, _args) => {

      const {  taskId  } = _args as any
    return await ctx.db.get(taskId)
  },
})

export const getWorkload = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query('tasks').order('desc').take(500)
    return aggregateWorkload(tasks)
  },
})

export const getBoard = query({
  handler: async (ctx) => {
    const all = await ctx.db.query('tasks').order('desc').take(200)
    const board: Record<string, typeof all> = {
      planning: [],
      ready: [],
      in_progress: [],
      in_review: [],
      done: [],
      blocked: [],
    }

    for (const task of all) {
      const s = normalizeStatus(task.status)
      if (board[s]) {
        board[s].push(task)
      }
    }

    return board
  },
})

// ⚠️ DEPRECATED — Returns legacy lease info from task fields
export const getLease = query({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, _args) => {

      const {  taskId  } = _args as any
    console.warn('DEPRECATED: getLease — lease management is no longer used. Use pushStatus instead.')
    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) return null
    return {
      leaseOwner: task.leaseOwner,
      leaseExpiresAt: task.leaseExpiresAt,
      handoffCount: task.handoffCount,
      version: task.version,
    }
  },
})

// ═══════════════════════════════════════════════════════════
// MUTATIONS — Agent Workflow (from clawd)
// ═══════════════════════════════════════════════════════════

/** Primary API for status updates from OpenClaw agents */
export const pushStatus = mutation({
  args: {
    taskId: v.id('tasks'),
    status: STATUS_VALUES,
    actor: v.string(),
    note: v.optional(v.string()),
    runId: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {

      const {  taskId, status, actor, note, runId, sessionKey  } = _args as any
    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')

    const now = Date.now()
    const timestamp = new Date(now).toISOString()
    const logEntry = `[${timestamp}] ${actor}: status → ${status}${note ? ` — ${note}` : ''}`

    const existingNotes = task.notes || ''
    const updatedNotes = existingNotes
      ? `${existingNotes}\n${logEntry}`
      : logEntry

    const patch: Record<string, unknown> = {
      status,
      notes: sanitizeText(updatedNotes, 4000),
      version: (task.version || 0) + 1,
    }

    if (status === 'in_progress' && !task.startedAt) {
      patch.startedAt = now
    }
    if (status === 'done') {
      patch.completedAt = now
    }
    if (runId !== undefined) patch.runId = runId
    if (sessionKey !== undefined) patch.sessionKey = sessionKey

    await ctx.db.patch(taskId, patch)
    return { ok: true, version: patch.version }
  },
})

/** Append timeline event to task notes */
export const pushEvent = mutation({
  args: {
    taskId: v.id('tasks'),
    event: v.string(),
    actor: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {

      const {  taskId, event, actor, details  } = _args as any
    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')

    const now = Date.now()
    const timestamp = new Date(now).toISOString()
    const logEntry = `[${timestamp}] ${actor}: ${event}${details ? ` — ${details}` : ''}`

    const existingNotes = task.notes || ''
    const updatedNotes = existingNotes
      ? `${existingNotes}\n${logEntry}`
      : logEntry

    await ctx.db.patch(taskId, {
      notes: sanitizeText(updatedNotes, 4000),
      version: (task.version || 0) + 1,
    })
    return { ok: true }
  },
})

/** Full task creation with dependency validation and sanitization */
export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    assignedAgent: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    priority: v.optional(PRIORITY_VALUES),
    status: v.optional(STATUS_VALUES),
    dueAt: v.optional(v.number()),
    parentTask: v.optional(v.id('tasks')),
    dependsOn: v.optional(v.array(v.id('tasks'))),
    tags: v.optional(v.array(v.string())),
    project: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {
    const args = _args as any
    await validateDependencies(ctx, '__new__', args.dependsOn?.map((id: any) => String(id)))

    const defaultStatus = args.assignedAgent ? 'ready' : 'planning'
    return await ctx.db.insert('tasks', {
      title: sanitizeText(args.title, 200),
      description: sanitizeOptionalText(args.description, 4000),
      assignedAgent: sanitizeOptionalText(args.assignedAgent, 80),
      createdBy: sanitizeText(args.createdBy ?? 'main', 80),
      status: args.status ?? defaultStatus,
      priority: args.priority ?? 'normal',
      createdAt: Date.now(),
      startedAt: args.status === 'in_progress' ? Date.now() : undefined,
      dueAt: args.dueAt,
      parentTask: args.parentTask,
      dependsOn: args.dependsOn,
      tags: args.tags,
      project: sanitizeOptionalText(args.project, 200),
      notes: sanitizeOptionalText(args.notes, 4000),
      version: 0,
      attemptCount: 0,
    })
  },
})

/** Agent claims a task */
export const claimTask = mutation({
  args: {
    taskId: v.id('tasks'),
    agent: v.string(),
  },
  handler: async (ctx, _args) => {

      const {  taskId, agent  } = _args as any
    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')
    if (!['planning', 'ready', 'pending'].includes(task.status)) {
      throw new Error(`Task not claimable (status: ${task.status})`)
    }
    await ctx.db.patch(taskId, {
      assignedAgent: agent,
      status: 'in_progress',
      startedAt: Date.now(),
      version: (task.version || 0) + 1,
    })
    return taskId
  },
})

/** Move task to in_progress */
export const startTask = mutation({
  args: {
    taskId: v.id('tasks'),
  },
  handler: async (ctx, _args) => {

      const {  taskId  } = _args as any
    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')
    if (!['planning', 'ready', 'pending', 'active'].includes(task.status)) {
      throw new Error(`Cannot start task (status: ${task.status})`)
    }
    await ctx.db.patch(taskId, {
      status: 'in_progress',
      startedAt: task.startedAt ?? Date.now(),
      version: (task.version || 0) + 1,
    })
    return taskId
  },
})

/** Submit task for review */
export const submitForReview = mutation({
  args: {
    taskId: v.id('tasks'),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {

      const {  taskId, notes  } = _args as any
    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')
    if (!isValidTransition(task.status, 'in_review')) {
      throw new Error(`Cannot submit for review from status: ${task.status}`)
    }
    const patch: Record<string, unknown> = {
      status: 'in_review',
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      version: (task.version || 0) + 1,
    }
    if (notes) patch.notes = sanitizeText(notes, 4000)
    await ctx.db.patch(taskId, patch)
    return taskId
  },
})

/** Submit for review and assign reviewer */
export const submitForReviewAndAssign = mutation({
  args: {
    taskId: v.id('tasks'),
    reviewer: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {

      const {  taskId, reviewer, notes  } = _args as any
    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')
    if (!isValidTransition(task.status, 'in_review')) {
      throw new Error(`Cannot submit for review from status: ${task.status}`)
    }
    const patch: Record<string, unknown> = {
      status: 'in_review',
      assignedAgent: reviewer,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      version: (task.version || 0) + 1,
    }
    if (notes) patch.notes = sanitizeText(notes, 4000)
    await ctx.db.patch(taskId, patch)
    return taskId
  },
})

/** Mark task as done */
export const completeTask = mutation({
  args: {
    taskId: v.id('tasks'),
    result: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {

      const {  taskId, result  } = _args as any
    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')
    if (task.status === 'done') {
      throw new Error('Task already completed')
    }
    if (task.status === 'cancelled') {
      throw new Error('Cannot complete a cancelled task')
    }
    await ctx.db.patch(taskId, {
      status: 'done',
      completedAt: Date.now(),
      result: sanitizeOptionalText(result, 4000),
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      version: (task.version || 0) + 1,
    })
    return taskId
  },
})

/** Full update with state transition validation and dependency checking */
export const updateTask = mutation({
  args: {
    taskId: v.id('tasks'),
    status: v.optional(STATUS_VALUES),
    notes: v.optional(v.string()),
    blockedReason: v.optional(v.string()),
    priority: v.optional(PRIORITY_VALUES),
    assignedAgent: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    project: v.optional(v.string()),
    dependsOn: v.optional(v.array(v.string())),
    expectedVersion: v.optional(v.number()),
  },
  handler: async (ctx, _args) => {

      const { taskId, ...fields } = _args as any
    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')

    if (fields.expectedVersion !== undefined && (task.version || 0) !== fields.expectedVersion) {
      throw new Error(
        `Version mismatch for ${taskId}: expected ${fields.expectedVersion}, actual ${task.version || 0}`,
      )
    }

    if (fields.status !== undefined) {
      if (!isValidTransition(task.status, fields.status)) {
        throw new Error(
          `Invalid transition: ${task.status} → ${fields.status}. ` +
          `Allowed: ${VALID_TRANSITIONS[task.status]?.join(', ') || 'none'}`
        )
      }
    }

    if (fields.dependsOn !== undefined) {
      await validateDependencies(ctx as any, String(taskId), fields.dependsOn)
    }

    const patch: Record<string, unknown> = {}
    if (fields.status !== undefined && task.status === 'blocked' && fields.status !== 'blocked') {
      patch.blockedReason = undefined
    }
    if (fields.status !== undefined) patch.status = fields.status
    if (fields.notes !== undefined) patch.notes = sanitizeOptionalText(fields.notes, 4000)
    if (fields.blockedReason !== undefined) patch.blockedReason = sanitizeOptionalText(fields.blockedReason, 1000)
    if (fields.priority !== undefined) patch.priority = fields.priority
    if (fields.assignedAgent !== undefined) patch.assignedAgent = sanitizeOptionalText(fields.assignedAgent, 80)
    if (fields.title !== undefined) patch.title = sanitizeOptionalText(fields.title, 200)
    if (fields.description !== undefined) patch.description = sanitizeOptionalText(fields.description, 4000)
    if (fields.project !== undefined) patch.project = sanitizeOptionalText(fields.project, 200)
    if (fields.dependsOn !== undefined) patch.dependsOn = fields.dependsOn

    if (fields.status === 'in_progress' && !task.startedAt) {
      patch.startedAt = Date.now()
    }
    if (fields.status === 'done') {
      patch.completedAt = Date.now()
      patch.leaseOwner = undefined
      patch.leaseExpiresAt = undefined
    }
    if (
      fields.status === 'ready' ||
      fields.status === 'planning' ||
      fields.status === 'in_review' ||
      fields.status === 'blocked'
    ) {
      patch.leaseOwner = undefined
      patch.leaseExpiresAt = undefined
    }

    patch.version = (task.version || 0) + 1
    await ctx.db.patch(taskId, patch)
    return taskId
  },
})

/** Agent-to-agent handoff */
export const handoffTask = mutation({
  args: {
    taskId: v.id('tasks'),
    toAgent: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {

      const {  taskId, toAgent, notes  } = _args as any
    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')
    await ctx.db.patch(taskId, {
      assignedAgent: sanitizeText(toAgent, 80),
      notes: sanitizeOptionalText(notes ?? task.notes, 4000),
      status: 'ready',
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      version: (task.version || 0) + 1,
    })
    return taskId
  },
})

/** Delete task by ID */
export const deleteTask = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, _args) => {

      const {  taskId  } = _args as any
    await ctx.db.delete(taskId)
  },
})

// ═══════════════════════════════════════════════════════════
// MUTATIONS — Dashboard CRUD (original, kept for backward compat)
// ═══════════════════════════════════════════════════════════

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
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    if (!validPriorities.includes(args!.priority as unknown as string)) {
      throw new Error(`Invalid priority: ${args!.priority}. Must be one of: ${validPriorities.join(', ')}`)
    }
    
    if (args!.status) {
      const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
      if (!validStatuses.includes(args!.status as unknown as string)) {
        throw new Error(`Invalid status: ${args!.status}. Must be one of: ${validStatuses.join(', ')}`)
      }
    }
    
    const createdBy = args!.createdBy || 'api'

    const taskId = await ctx.db.insert('tasks', {
      title: args!.title,
      priority: args!.priority as any,
      project: args!.project,
      notes: args!.notes,
      assignedAgent: args!.assignedAgent || 'unassigned',
      createdBy,
      status: (args!.status || 'planning') as any,
      createdAt: Date.now(),
    })

    await ctx.db.insert('activityLog', {
      taskId,
      actor: createdBy,
      actorType: (createdBy as unknown as string) === 'api' ? 'system' : 'user',
      action: 'created',
      metadata: {
        notes: `Created task: ${args!.title}`,
      },
      timestamp: Date.now(),
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
    const task = await ctx.db.get(args!.id)
    if (!task) {
      throw new Error(`Task not found: ${args!.id}`)
    }
    
    if (args!.status) {
      const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
      if (!validStatuses.includes(args!.status as unknown as string)) {
        throw new Error(`Invalid status: ${args!.status}. Must be one of: ${validStatuses.join(', ')}`)
      }
    }
    
    if (args!.priority) {
      const validPriorities = ['low', 'normal', 'high', 'urgent']
      if (!validPriorities.includes(args!.priority as unknown as string)) {
        throw new Error(`Invalid priority: ${args!.priority}. Must be one of: ${validPriorities.join(', ')}`)
      }
    }
    
    const updates: Record<string, unknown> = {}
    if (args!.status !== undefined) updates.status = args!.status
    if (args!.priority !== undefined) updates.priority = args!.priority
    if (args!.assignedAgent !== undefined) updates.assignedAgent = args!.assignedAgent
    if (args!.notes !== undefined) updates.notes = args!.notes
    
    await ctx.db.patch(args!.id, updates)

    if (args!.status !== undefined && args!.status !== task.status) {
      await ctx.db.insert('activityLog', {
        taskId: args!.id,
        actor: 'system',
        actorType: 'system',
        action: 'status_changed',
        metadata: {
          fromStatus: task.status || 'planning',
          toStatus: args!.status,
        },
        timestamp: Date.now(),
      })
    } else if (args!.priority !== undefined && args!.priority !== task.priority) {
      await ctx.db.insert('activityLog', {
        taskId: args!.id,
        actor: 'system',
        actorType: 'system',
        action: 'priority_changed',
        metadata: {
          fromStatus: task.priority || 'normal',
          toStatus: args!.priority,
        },
        timestamp: Date.now(),
      })
    } else {
      const changedFields = Object.keys(updates).join(', ')
      await ctx.db.insert('activityLog', {
        taskId: args!.id,
        actor: 'system',
        actorType: 'system',
        action: 'updated',
        metadata: {
          notes: `Updated fields: ${changedFields}`,
        },
        timestamp: Date.now(),
      })
    }

    return { success: true }
  },
})

export const remove = mutation({
  args: {
    id: v.id('tasks'),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args!.id)
    if (!task) {
      throw new Error('Task not found')
    }

    await ctx.db.delete(args!.id)

    await ctx.db.insert('activityLog', {
      taskId: args!.id,
      actor: 'system',
      actorType: 'system',
      action: 'deleted',
      metadata: {
        notes: `Deleted task: ${task.title}`,
      },
      timestamp: Date.now(),
    })

    return { success: true }
  },
})

// ═══════════════════════════════════════════════════════════
// DEPRECATED Mutations (backward compat, log warnings)
// ═══════════════════════════════════════════════════════════

export const recoverStaleTasks = mutation({
  args: {
    staleThresholdMs: v.optional(v.number()),
    systemToken: v.optional(v.string()),
  },
  handler: async (_ctx, _args) => {
    console.warn('DEPRECATED: recoverStaleTasks is a no-op. OpenClaw sessions_spawn handles dispatch now.')
    return { recovered: [], count: 0 }
  },
})

export const agentHeartbeat = mutation({
  args: {
    taskId: v.id('tasks'),
    agent: v.string(),
    systemToken: v.optional(v.string()),
  },
  handler: async (_ctx, _args) => {
    console.warn('DEPRECATED: agentHeartbeat is a no-op. OpenClaw sessions_spawn handles liveness now.')
    return { ok: true, nextHeartbeatBefore: Date.now() + DEFAULT_LEASE_TTL_MS }
  },
})

/** @deprecated Still functional but rarely needed */
export const sanitizeTaskTextFields = mutation({
  args: {
    limit: v.optional(v.number()),
    systemToken: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {

      const {  limit, systemToken  } = _args as any
    console.warn('DEPRECATED: sanitizeTaskTextFields — still functional but rarely needed.')
    if (!verifySystemToken(systemToken)) {
      throw new Error('Authentication failed')
    }
    const max = Math.max(1, Math.min(limit ?? 500, 2000))
    const tasks = await ctx.db.query('tasks').order('desc').take(max)
    let scanned = 0
    let updated = 0

    for (const task of tasks) {
      scanned += 1
      const patch: Record<string, unknown> = {}
      const currentVersion = task.version || 0

      const cleanTitle = sanitizeText(task.title ?? '', 200)
      if (cleanTitle !== task.title) patch.title = cleanTitle

      const cleanDescription = sanitizeOptionalText(task.description, 4000)
      if (cleanDescription !== task.description) patch.description = cleanDescription

      const cleanNotes = sanitizeOptionalText(task.notes, 4000)
      if (cleanNotes !== task.notes) patch.notes = cleanNotes

      const cleanResult = sanitizeOptionalText(task.result, 4000)
      if (cleanResult !== task.result) patch.result = cleanResult

      const cleanBlockedReason = sanitizeOptionalText(task.blockedReason, 1000)
      if (cleanBlockedReason !== task.blockedReason) patch.blockedReason = cleanBlockedReason

      const cleanProject = sanitizeOptionalText(task.project, 200)
      if (cleanProject !== task.project) patch.project = cleanProject

      const cleanAssignedAgent = sanitizeOptionalText(task.assignedAgent, 80)
      if (cleanAssignedAgent !== task.assignedAgent) patch.assignedAgent = cleanAssignedAgent

      if (Object.keys(patch).length > 0) {
        patch.version = currentVersion + 1
        await ctx.db.patch(task._id, patch)
        updated += 1
      }
    }

    return { scanned, updated }
  },
})

export const acquireLease = mutation({
  args: {
    taskId: v.id('tasks'),
    owner: v.string(),
    ttlMs: v.number(),
    systemToken: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {

      const {  taskId, owner, ttlMs, systemToken  } = _args as any
    console.warn('DEPRECATED: acquireLease — lease management is no longer needed. Use pushStatus instead.')
    if (!verifySystemToken(systemToken)) {
      throw new Error('Authentication failed')
    }

    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')

    const now = Date.now()
    const expiresAt = now + ttlMs
    const currentVersion = task.version || 0

    if (task.leaseOwner && task.leaseExpiresAt) {
      if (task.leaseExpiresAt > now) {
        if (task.leaseOwner !== owner) {
          throw new Error('Lease is held by another owner')
        }
        await ctx.db.patch(taskId, {
          leaseExpiresAt: expiresAt,
          version: currentVersion + 1,
        })
        return { owner, expiresAt, version: currentVersion + 1 }
      }
    }

    await ctx.db.patch(taskId, {
      leaseOwner: owner,
      leaseExpiresAt: expiresAt,
      version: currentVersion + 1,
    })

    return { owner, expiresAt, version: currentVersion + 1 }
  },
})

export const releaseLease = mutation({
  args: {
    taskId: v.id('tasks'),
    owner: v.string(),
    expectedVersion: v.optional(v.number()),
    systemToken: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {

      const {  taskId, owner, expectedVersion, systemToken  } = _args as any
    console.warn('DEPRECATED: releaseLease — lease management is no longer needed. Use pushStatus instead.')
    if (!verifySystemToken(systemToken)) {
      throw new Error('Authentication failed')
    }

    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')

    if (expectedVersion !== undefined) {
      const currentVersion = task.version || 0
      if (currentVersion !== expectedVersion) {
        throw new Error('Concurrent modification - retry')
      }
    }

    if (task.leaseOwner !== owner) {
      throw new Error('Cannot release lease: not the current owner')
    }

    const currentVersion = task.version || 0
    await ctx.db.patch(taskId, {
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      version: currentVersion + 1,
    })

    return { released: true }
  },
})

export const refreshLease = mutation({
  args: {
    taskId: v.id('tasks'),
    owner: v.string(),
    ttlMs: v.number(),
    expectedVersion: v.optional(v.number()),
    systemToken: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {

      const {  taskId, owner, ttlMs, expectedVersion, systemToken  } = _args as any
    console.warn('DEPRECATED: refreshLease — lease management is no longer needed. Use pushStatus instead.')
    if (!verifySystemToken(systemToken)) {
      throw new Error('Authentication failed')
    }

    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')

    if (task.leaseOwner !== owner) {
      throw new Error('Cannot refresh lease: not the current owner')
    }

    const now = Date.now()
    if (task.leaseExpiresAt && task.leaseExpiresAt <= now) {
      throw new Error('Cannot refresh: lease has expired')
    }

    if (expectedVersion !== undefined) {
      const currentVersion = task.version || 0
      if (currentVersion !== expectedVersion) {
        throw new Error('Concurrent modification - retry')
      }
    }

    const currentVersion = task.version || 0
    const expiresAt = now + ttlMs

    await ctx.db.patch(taskId, {
      leaseExpiresAt: expiresAt,
      version: currentVersion + 1,
    })

    return { owner, expiresAt, version: currentVersion + 1 }
  },
})

export const transferLease = mutation({
  args: {
    taskId: v.id('tasks'),
    fromOwner: v.string(),
    toOwner: v.string(),
    ttlMs: v.optional(v.number()),
    expectedVersion: v.optional(v.number()),
    systemToken: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {

      const {  taskId, fromOwner, toOwner, ttlMs, expectedVersion, systemToken  } = _args as any
    console.warn('DEPRECATED: transferLease — lease management is no longer needed. Use pushStatus instead.')
    if (!verifySystemToken(systemToken)) {
      throw new Error('Authentication failed')
    }

    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')

    if (expectedVersion !== undefined) {
      const currentVersion = task.version || 0
      if (currentVersion !== expectedVersion) {
        throw new Error('Concurrent modification - retry')
      }
    }

    const now = Date.now()
    const currentVersion = task.version || 0

    if (task.leaseOwner !== fromOwner) {
      throw new Error('Transfer failed: lease not held by the specified owner')
    }

    if (task.leaseExpiresAt && task.leaseExpiresAt <= now) {
      throw new Error('Transfer failed: lease has expired')
    }

    const remainingMs = task.leaseExpiresAt ? task.leaseExpiresAt - now : 0
    const newTtlMs = ttlMs ?? remainingMs
    const newExpiresAt = now + newTtlMs
    const handoffCount = (task.handoffCount || 0) + 1

    await ctx.db.patch(taskId, {
      leaseOwner: toOwner,
      leaseExpiresAt: newExpiresAt,
      handoffCount: handoffCount,
      version: currentVersion + 1,
    })

    return { fromOwner, toOwner, expiresAt: newExpiresAt, handoffCount, version: currentVersion + 1 }
  },
})

export const casClaim = mutation({
  args: {
    taskId: v.id('tasks'),
    agent: v.string(),
    fromStatuses: v.string(),
    toStatus: v.string(),
    leaseTtlMs: v.optional(v.number()),
    systemToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.warn('DEPRECATED: casClaim — use pushStatus instead. OpenClaw sessions_spawn handles dispatch.')
    const taskId = args!.taskId as unknown as Id<"tasks">
    const agent = args!.agent as unknown as string
    const fromStatuses = args!.fromStatuses as unknown as string
    const toStatus = args!.toStatus as unknown as string
    const leaseTtlMs = args!.leaseTtlMs as unknown as number | undefined
    const systemToken = args!.systemToken as unknown as string | undefined

    if (!verifySystemToken(systemToken)) {
      throw new Error('Authentication failed')
    }

    const task = await ctx.db.get(taskId)
    if (!task) {
      return { success: false, error: 'Task not found' }
    }

    const allowed = fromStatuses.split(',').map((s: string) => s.trim())
    if (!allowed.includes(task.status)) {
      return {
        success: false,
        error: 'Task status not in allowed list',
        currentStatus: task.status,
      }
    }

    const now = Date.now()

    if (task.leaseOwner && task.leaseExpiresAt && task.leaseExpiresAt > now) {
      if (task.leaseOwner !== agent) {
        return {
          success: false,
          error: 'Another agent holds the lease',
          leaseOwner: task.leaseOwner,
        }
      }
    }

    const currentVersion = task.version || 0
    const ttl = leaseTtlMs ?? DEFAULT_LEASE_TTL_MS
    const attempts = (task.attemptCount || 0) + 1

    await ctx.db.patch(taskId, {
      assignedAgent: agent,
      status: toStatus as any,
      startedAt: task.startedAt ?? now,
      leaseOwner: agent,
      leaseExpiresAt: now + ttl,
      attemptCount: attempts,
      version: currentVersion + 1,
    })

    return {
      success: true,
      previousStatus: task.status,
      version: currentVersion + 1,
      leaseOwner: agent,
      leaseExpiresAt: now + ttl,
    }
  },
})
