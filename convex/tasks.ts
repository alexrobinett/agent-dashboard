import { query, mutation, internalMutation, type MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { internal } from './_generated/api'
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

export function formatTaskKey(taskNumber: number): string {
  return `AD-${taskNumber}`
}

function parseTaskNumberFromKey(taskKey?: string): number | null {
  if (!taskKey) return null
  const match = /^AD-(\d+)$/i.exec(taskKey.trim())
  if (!match) return null
  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : null
}

async function getMaxTaskNumber(ctx: { db: { query: (table: 'tasks') => any } }): Promise<number> {
  const baseQuery = ctx.db.query('tasks')
  const maybeWithIndex = (baseQuery as { withIndex?: (name: string, fn?: (q: any) => any) => any }).withIndex

  if (typeof maybeWithIndex === 'function') {
    const rows = await maybeWithIndex.call(baseQuery, 'by_task_number').order('desc').take(500)
    let max = 0
    for (const row of rows) {
      if (typeof row.taskNumber === 'number') {
        max = Math.max(max, row.taskNumber)
      } else {
        max = Math.max(max, parseTaskNumberFromKey(row.taskKey) ?? 0)
      }
    }
    return max
  }

  const rows = await baseQuery.order('desc').take(1000)
  let max = 0
  for (const row of rows) {
    if (typeof row.taskNumber === 'number') {
      max = Math.max(max, row.taskNumber)
    } else {
      max = Math.max(max, parseTaskNumberFromKey(row.taskKey) ?? 0)
    }
  }
  return max
}

async function allocateFriendlyTaskKey(ctx: { db: { query: (table: 'tasks') => any } }) {
  const nextTaskNumber = (await getMaxTaskNumber(ctx)) + 1
  return {
    taskNumber: nextTaskNumber,
    taskKey: formatTaskKey(nextTaskNumber),
  }
}

async function queueTaskDoneNotification(
  ctx: { runMutation: (mutation: unknown, args: { taskId: Id<'tasks'>; agentName: string }) => Promise<unknown> },
  taskId: Id<'tasks'>,
  taskBeforeUpdate: { assignedAgent?: string | undefined },
) {
  if (!taskBeforeUpdate.assignedAgent) return
  await ctx.runMutation(internal.notifications.notifyTaskDone, {
    taskId,
    agentName: taskBeforeUpdate.assignedAgent,
  })
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

type QueryCtx = { db: { query: (table: 'tasks') => any } }
type IndexSelector = (q: any) => any
type ActivityQueryCtx = { db: { query: (table: 'activityLog') => any } }
type PaginatedResult<T> = {
  page: T[]
  continueCursor: string
  isDone: boolean
}

/**
 * Test mocks in this repo expose query().order().take() without withIndex().
 * Use withIndex when available in runtime, otherwise fall back to ordered scan.
 */
async function queryTasksWithOptionalIndex(
  ctx: QueryCtx,
  take: number,
  indexName?: string,
  indexSelector?: IndexSelector,
) {
  const baseQuery = ctx.db.query('tasks')
  const maybeWithIndex = (baseQuery as { withIndex?: (name: string, fn?: IndexSelector) => any }).withIndex
  const orderedQuery =
    indexName && typeof maybeWithIndex === 'function'
      ? maybeWithIndex.call(baseQuery, indexName, indexSelector).order('desc')
      : baseQuery.order('desc')
  return await orderedQuery.take(take)
}

async function collectAllFromOrderedQuery<T>(orderedQuery: any, pageSize = 256): Promise<T[]> {
  const maybePaginate = (orderedQuery as {
    paginate?: (options: { numItems: number; cursor: string | null }) => Promise<PaginatedResult<T>>
  }).paginate
  if (typeof maybePaginate === 'function') {
    const rows: T[] = []
    let cursor: string | null = null
    do {
      const chunk = await maybePaginate.call(orderedQuery, { numItems: pageSize, cursor })
      rows.push(...chunk.page)
      if (chunk.isDone) break
      cursor = chunk.continueCursor
    } while (true)
    return rows
  }

  const maybeTake = (orderedQuery as { take?: (count: number) => Promise<T[]> }).take
  if (typeof maybeTake === 'function') {
    return await maybeTake.call(orderedQuery, pageSize)
  }
  return []
}

async function queryAllTasksWithOptionalIndex(
  ctx: QueryCtx,
  indexName?: string,
  indexSelector?: IndexSelector,
  pageSize = 256,
) {
  const baseQuery = ctx.db.query('tasks')
  const maybeWithIndex = (baseQuery as { withIndex?: (name: string, fn?: IndexSelector) => any }).withIndex
  const orderedQuery =
    indexName && typeof maybeWithIndex === 'function'
      ? maybeWithIndex.call(baseQuery, indexName, indexSelector).order('desc')
      : baseQuery.order('desc')
  return await collectAllFromOrderedQuery(orderedQuery, pageSize)
}

async function queryAllActivityWithOptionalIndex(
  ctx: ActivityQueryCtx,
  indexName?: string,
  indexSelector?: IndexSelector,
  pageSize = 256,
) {
  const baseQuery = ctx.db.query('activityLog')
  const maybeWithIndex = (baseQuery as { withIndex?: (name: string, fn?: IndexSelector) => any }).withIndex
  const orderedQuery =
    indexName && typeof maybeWithIndex === 'function'
      ? maybeWithIndex.call(baseQuery, indexName, indexSelector).order('desc')
      : baseQuery.order('desc')
  return await collectAllFromOrderedQuery(orderedQuery, pageSize)
}

type PresenceRank = {
  lastSeen: number
  startedAt: number
  createdAt: number
  taskId: string
}

function comparePresenceRank(a: PresenceRank, b: PresenceRank): number {
  if (a.lastSeen !== b.lastSeen) return a.lastSeen - b.lastSeen
  if (a.startedAt !== b.startedAt) return a.startedAt - b.startedAt
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
  return a.taskId.localeCompare(b.taskId)
}

// ═══════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════

// ─── Dashboard Queries (original) ───

export const list = query({
  handler: async (ctx) => {
    return await queryTasksWithOptionalIndex(ctx, 100, 'by_created_at')
  },
})

export const getByStatus = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await queryTasksWithOptionalIndex(ctx, 200, 'by_created_at')
    
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
    
    const status = args?.status
    const assignedAgent = args?.assignedAgent
    const project = args?.project
    const priority = args?.priority

    let filtered: any[]
    if (status && assignedAgent) {
      filtered = await queryTasksWithOptionalIndex(
        ctx,
        1000,
        'by_status_and_agent',
        (q) => q.eq('status', status).eq('assignedAgent', assignedAgent),
      )
    } else if (status) {
      filtered = await queryTasksWithOptionalIndex(ctx, 1000, 'by_status', (q) => q.eq('status', status))
    } else if (assignedAgent) {
      filtered = await queryTasksWithOptionalIndex(ctx, 1000, 'by_agent', (q) => q.eq('assignedAgent', assignedAgent))
    } else if (project) {
      filtered = await queryTasksWithOptionalIndex(ctx, 1000, 'by_project', (q) => q.eq('project', project))
    } else if (priority) {
      filtered = await queryTasksWithOptionalIndex(ctx, 1000, 'by_priority', (q) => q.eq('priority', priority))
    } else {
      filtered = await queryTasksWithOptionalIndex(ctx, 1000, 'by_created_at')
    }
    
    if (status) {
      filtered = filtered.filter(task => task.status === status)
    }
    if (priority) {
      filtered = filtered.filter(task => task.priority === priority)
    }
    if (project) {
      filtered = filtered.filter(task => task.project === project)
    }
    if (assignedAgent) {
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
    const tasks = await queryTasksWithOptionalIndex(ctx, 500, 'by_created_at')
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
    const { status, agent, project, limit } = (_args ?? {}) as any

    const max = limit ?? 100
    let tasks: any[]

    if (status && agent) {
      tasks = await queryTasksWithOptionalIndex(
        ctx,
        max,
        'by_status_and_agent',
        (q) => q.eq('status', status).eq('assignedAgent', agent),
      )
    } else if (status) {
      tasks = await queryTasksWithOptionalIndex(ctx, max, 'by_status', (q) => q.eq('status', status))
    } else if (agent) {
      tasks = await queryTasksWithOptionalIndex(ctx, max, 'by_agent', (q) => q.eq('assignedAgent', agent))
    } else if (project) {
      tasks = await queryTasksWithOptionalIndex(ctx, max, 'by_project', (q) => q.eq('project', project))
    } else {
      tasks = await queryTasksWithOptionalIndex(ctx, max, 'by_created_at')
    }

    if (project) tasks = tasks.filter((t) => t.project === project)
    if (status) tasks = tasks.filter((t) => t.status === status)
    if (agent) tasks = tasks.filter((t) => t.assignedAgent === agent)

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
    const tasks = await queryTasksWithOptionalIndex(ctx, 500, 'by_created_at')
    return aggregateWorkload(tasks)
  },
})

export const getBoard = query({
  handler: async (ctx) => {
    const all = await queryTasksWithOptionalIndex(ctx, 200, 'by_created_at')
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

/**
 * API shape for S7.4 live agent presence:
 * - `activeTask`: current non-terminal task selected per agent (most recently seen)
 * - `status`: active task status
 * - `lastSeen`: ms epoch derived from heartbeat first, then activity/task timestamps
 * - `elapsedRuntimeMs`: wall runtime since `startedAt` when available
 * - `costSoFarUsd`: optional running cost snapshot, only present when agent reports it
 */
export const getAgentPresence = query({
  args: {
    agent: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const max = Math.max(1, Math.min(args?.limit ?? 50, 200))
    const requestedAgent = args?.agent
    const now = Date.now()

    const tasks = requestedAgent
      ? await queryAllTasksWithOptionalIndex(
        ctx,
        'by_agent',
        (q) => q.eq('assignedAgent', requestedAgent),
      )
      : await queryAllTasksWithOptionalIndex(ctx, 'by_created_at')
    const activeTasks = tasks.filter((task) => {
      const assignedAgent = task.assignedAgent
      if (!assignedAgent) return false
      if (requestedAgent && assignedAgent !== requestedAgent) return false
      return task.status !== 'done' && task.status !== 'cancelled'
    })
    if (activeTasks.length === 0) return []

    const candidateTaskIds = new Set(activeTasks.map(task => String(task._id)))
    const recentActivity = await queryAllActivityWithOptionalIndex(ctx, 'by_timestamp')
    const activityLastSeenByTask = new Map<string, number>()
    for (const entry of recentActivity) {
      const taskId = String(entry.taskId)
      if (!candidateTaskIds.has(taskId)) continue
      if (typeof entry.timestamp !== 'number') continue
      const previous = activityLastSeenByTask.get(taskId) ?? 0
      if (entry.timestamp > previous) {
        activityLastSeenByTask.set(taskId, entry.timestamp)
      }
    }

    const chosenByAgent = new Map<string, { task: typeof activeTasks[number]; rank: PresenceRank }>()
    for (const task of activeTasks) {
      const taskId = String(task._id)
      const rank: PresenceRank = {
        lastSeen: Math.max(
          task.lastHeartbeatAt ?? 0,
          activityLastSeenByTask.get(taskId) ?? 0,
          task.startedAt ?? 0,
          task.createdAt ?? 0,
        ),
        startedAt: task.startedAt ?? 0,
        createdAt: task.createdAt ?? 0,
        taskId,
      }
      const agentName = task.assignedAgent as string
      const previous = chosenByAgent.get(agentName)
      if (!previous || comparePresenceRank(rank, previous.rank) > 0) {
        chosenByAgent.set(agentName, { task, rank })
      }
    }

    return [...chosenByAgent.entries()]
      .map(([agentName, selected]) => {
        const { task, rank } = selected
        return {
          agent: agentName,
          activeTask: {
            taskId: task._id,
            taskKey: task.taskKey,
            title: task.title,
            project: task.project,
          },
          status: task.status,
          runId: task.runId,
          sessionKey: task.sessionKey,
          lastSeen: rank.lastSeen,
          elapsedRuntimeMs: task.startedAt ? Math.max(0, now - task.startedAt) : null,
          costSoFarUsd: task.costSoFarUsd,
        }
      })
      .sort((a, b) => {
        if (b.lastSeen !== a.lastSeen) return b.lastSeen - a.lastSeen
        const agentOrder = a.agent.localeCompare(b.agent)
        if (agentOrder !== 0) return agentOrder
        return String(a.activeTask.taskId).localeCompare(String(b.activeTask.taskId))
      })
      .slice(0, max)
  },
})

// ═══════════════════════════════════════════════════════════
// MUTATIONS — Agent Workflow (from clawd)
// ═══════════════════════════════════════════════════════════

/**
 * Lightweight heartbeat contract for live presence.
 * Agents can call this periodically while a task is active to refresh `lastSeen`
 * and optionally update run/session identity plus running cost snapshots.
 */
export const heartbeat = mutation({
  args: {
    taskId: v.id('tasks'),
    actor: v.string(),
    runId: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
    costSoFarUsd: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, _args) => {
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const { taskId, actor, runId, sessionKey, costSoFarUsd, note } = _args as any
    const task = await ctx.db.get(taskId as Id<'tasks'>)
    if (!task) throw new Error('Task not found')

    const now = Date.now()
    const patch: Record<string, unknown> = {
      lastHeartbeatAt: now,
      version: (task.version || 0) + 1,
    }
    if (runId !== undefined) patch.runId = runId
    if (sessionKey !== undefined) patch.sessionKey = sessionKey
    if (costSoFarUsd !== undefined) patch.costSoFarUsd = Math.max(0, costSoFarUsd)
    if (note !== undefined) {
      const timestamp = new Date(now).toISOString()
      const existingNotes = task.notes || ''
      const heartbeatLog = `[${timestamp}] ${actor}: heartbeat${note ? ` — ${note}` : ''}`
      patch.notes = sanitizeText(existingNotes ? `${existingNotes}\n${heartbeatLog}` : heartbeatLog, 4000)
    }

    await ctx.db.patch(taskId, patch)
    return {
      ok: true,
      lastSeen: now,
      version: patch.version,
    }
  },
})

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
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

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
    if (task.status !== 'done' && status === 'done') {
      await queueTaskDoneNotification(ctx, taskId, task)
    }
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
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

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
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')
    const args = _args as any
    await validateDependencies(ctx, '__new__', args.dependsOn?.map((id: any) => String(id)))

    const defaultStatus = args.assignedAgent ? 'ready' : 'planning'
    const { taskNumber, taskKey } = await allocateFriendlyTaskKey(ctx)
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
      taskNumber,
      taskKey,
      version: 0,
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
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

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
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

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
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

      const {  taskId, notes  } = _args as any
    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')
    if (!isValidTransition(task.status, 'in_review')) {
      throw new Error(`Cannot submit for review from status: ${task.status}`)
    }
    const patch: Record<string, unknown> = {
      status: 'in_review',
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
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

      const {  taskId, reviewer, notes  } = _args as any
    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')
    if (!isValidTransition(task.status, 'in_review')) {
      throw new Error(`Cannot submit for review from status: ${task.status}`)
    }
    const patch: Record<string, unknown> = {
      status: 'in_review',
      assignedAgent: reviewer,
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
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

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
      version: (task.version || 0) + 1,
    })
    await queueTaskDoneNotification(ctx, taskId, task)
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
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

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
    }

    patch.version = (task.version || 0) + 1
    await ctx.db.patch(taskId, patch)
    if (fields.status === 'done' && task.status !== 'done') {
      await queueTaskDoneNotification(ctx, taskId, task)
    }
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
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

      const {  taskId, toAgent, notes  } = _args as any
    const task = await ctx.db.get(taskId as Id<"tasks">)
    if (!task) throw new Error('Task not found')
    await ctx.db.patch(taskId, {
      assignedAgent: sanitizeText(toAgent, 80),
      notes: sanitizeOptionalText(notes ?? task.notes, 4000),
      status: 'ready',
      version: (task.version || 0) + 1,
    })
    return taskId
  },
})

/** Delete task by ID */
export const deleteTask = mutation({
  args: { taskId: v.id('tasks') },
  handler: async (ctx, _args) => {
    // [security] Require authenticated Convex identity (j57bds0a8vv8qk349dqsnfw65h81d99x)
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

      const {  taskId  } = _args as any
    await ctx.db.delete(taskId)
  },
})

// ═══════════════════════════════════════════════════════════
// MUTATIONS — Dashboard CRUD (internal: called only from HTTP actions)
// [security] Converted to internalMutation so they can only be invoked from
// Convex HTTP actions (which already enforce Bearer token auth), not directly
// from external Convex clients. (j57bds0a8vv8qk349dqsnfw65h81d99x)
// ═══════════════════════════════════════════════════════════

export const create = internalMutation({
  args: {
    title: v.string(),
    priority: v.string(),
    project: v.string(),
    notes: v.optional(v.string()),
    assignedAgent: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx: MutationCtx, args: any) => {
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
    const { taskNumber, taskKey } = await allocateFriendlyTaskKey(ctx)

    const taskId = await ctx.db.insert('tasks', {
      title: args!.title,
      priority: args!.priority as any,
      project: args!.project,
      notes: args!.notes,
      assignedAgent: args!.assignedAgent || 'unassigned',
      createdBy,
      status: (args!.status || 'planning') as any,
      createdAt: Date.now(),
      taskNumber,
      taskKey,
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

export const update = internalMutation({
  args: {
    id: v.id('tasks'),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    assignedAgent: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx: MutationCtx, args: any) => {
    const input = args as unknown as {
      id: Id<'tasks'>
      status?: string
      priority?: string
      assignedAgent?: string
      notes?: string
    }
    const task = await ctx.db.get(input.id)
    if (!task) {
      throw new Error(`Task not found: ${input.id}`)
    }
    
    if (input.status) {
      const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
      if (!validStatuses.includes(input.status)) {
        throw new Error(`Invalid status: ${input.status}. Must be one of: ${validStatuses.join(', ')}`)
      }
    }
    
    if (input.priority) {
      const validPriorities = ['low', 'normal', 'high', 'urgent']
      if (!validPriorities.includes(input.priority)) {
        throw new Error(`Invalid priority: ${input.priority}. Must be one of: ${validPriorities.join(', ')}`)
      }
    }
    
    const updates: Record<string, unknown> = {}
    if (input.status !== undefined) updates.status = input.status
    if (input.priority !== undefined) updates.priority = input.priority
    if (input.assignedAgent !== undefined) updates.assignedAgent = input.assignedAgent
    if (input.notes !== undefined) updates.notes = input.notes
    
    await ctx.db.patch(input.id, updates)
    if (input.status === 'done' && task.status !== 'done') {
      await queueTaskDoneNotification(ctx, input.id, task)
    }

    if (input.status !== undefined && input.status !== task.status) {
      await ctx.db.insert('activityLog', {
        taskId: input.id,
        actor: 'system',
        actorType: 'system',
        action: 'status_changed',
        metadata: {
          fromStatus: task.status || 'planning',
          toStatus: input.status,
        },
        timestamp: Date.now(),
      })
    } else if (input.priority !== undefined && input.priority !== task.priority) {
      await ctx.db.insert('activityLog', {
        taskId: input.id,
        actor: 'system',
        actorType: 'system',
        action: 'priority_changed',
        metadata: {
          fromStatus: task.priority || 'normal',
          toStatus: input.priority,
        },
        timestamp: Date.now(),
      })
    } else {
      const changedFields = Object.keys(updates).join(', ')
      await ctx.db.insert('activityLog', {
        taskId: input.id,
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

export const remove = internalMutation({
  args: {
    id: v.id('tasks'),
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (ctx: MutationCtx, args: any) => {
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

/** Backfill missing human-friendly task keys for historical rows. */
export const backfillFriendlyTaskKeys = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx: MutationCtx, args: { limit?: number }) => {
    const max = Math.max(1, Math.min(args.limit ?? 100, 1000))
    const tasks = await queryTasksWithOptionalIndex(ctx, 5000, 'by_created_at')
    let nextTaskNumber = await getMaxTaskNumber(ctx)

    let updated = 0
    for (const task of [...tasks].reverse()) {
      if (updated >= max) break
      if (task.taskKey && typeof task.taskNumber === 'number') continue

      nextTaskNumber += 1
      await ctx.db.patch(task._id, {
        taskNumber: nextTaskNumber,
        taskKey: formatTaskKey(nextTaskNumber),
      })
      updated += 1
    }

    return { updated }
  },
})

// EOF — deprecated lease/CAS mutations removed in Phase 4 cleanup
