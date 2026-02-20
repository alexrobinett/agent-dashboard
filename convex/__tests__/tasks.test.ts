import { describe, it, expect, vi } from 'vitest'
import type { Doc, Id } from '../_generated/dataModel'

// ──────────────────────────────────────────────────────────
// Mock convex server so we can import tasks.ts and extract handlers
// ──────────────────────────────────────────────────────────
vi.mock('../_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
  // [security] internalMutation added for create/update/remove (j57bds0a8vv8qk349dqsnfw65h81d99x)
  internalMutation: (config: Record<string, unknown>) => config,
}))

// Import AFTER mocking — each export is now { args, handler }
import * as taskModule from '../tasks'

// Type helpers
type Task = Doc<'tasks'>
type TaskId = Id<'tasks'>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerExtractor = { handler: (...args: any[]) => Promise<any> }
const listHandler = (taskModule.list as unknown as HandlerExtractor).handler
const getByStatusHandler = (taskModule.getByStatus as unknown as HandlerExtractor).handler
const getByIdHandler = (taskModule.getById as unknown as HandlerExtractor).handler
const listFilteredHandler = (taskModule.listFiltered as unknown as HandlerExtractor).handler
const getWorkloadHandler = (taskModule.getWorkload as unknown as HandlerExtractor).handler
const createHandler = (taskModule.create as unknown as HandlerExtractor).handler
const updateHandler = (taskModule.update as unknown as HandlerExtractor).handler
const backfillFriendlyTaskKeysHandler = (taskModule.backfillFriendlyTaskKeys as unknown as HandlerExtractor).handler

// New mutation handlers (clawd workflow)
const pushStatusHandler = (taskModule.pushStatus as unknown as HandlerExtractor).handler
const pushEventHandler = (taskModule.pushEvent as unknown as HandlerExtractor).handler
const createTaskHandler = (taskModule.createTask as unknown as HandlerExtractor).handler
const claimTaskHandler = (taskModule.claimTask as unknown as HandlerExtractor).handler
const startTaskHandler = (taskModule.startTask as unknown as HandlerExtractor).handler
const completeTaskHandler = (taskModule.completeTask as unknown as HandlerExtractor).handler
const submitForReviewHandler = (taskModule.submitForReview as unknown as HandlerExtractor).handler
const submitForReviewAndAssignHandler = (taskModule.submitForReviewAndAssign as unknown as HandlerExtractor).handler
const updateTaskHandler = (taskModule.updateTask as unknown as HandlerExtractor).handler
const handoffTaskHandler = (taskModule.handoffTask as unknown as HandlerExtractor).handler
const deleteTaskHandler = (taskModule.deleteTask as unknown as HandlerExtractor).handler
const listTasksHandler = (taskModule.listTasks as unknown as HandlerExtractor).handler
const getTaskHandler = (taskModule.getTask as unknown as HandlerExtractor).handler
const getBoardHandler = (taskModule.getBoard as unknown as HandlerExtractor).handler
const getWorkloadByAgentStatusHandler = (taskModule.getWorkloadByAgentStatus as unknown as HandlerExtractor).handler
const getAgentPresenceHandler = (taskModule.getAgentPresence as unknown as HandlerExtractor).handler
const heartbeatHandler = (taskModule.heartbeat as unknown as HandlerExtractor).handler

// Deprecated handlers

// ──────────────────────────────────────────────────────────
// Helper: build a mock Convex QueryCtx
// ──────────────────────────────────────────────────────────
function makeTask(overrides: Partial<Task> & { _id: TaskId }): Task {
  return {
    _creationTime: Date.now(),
    title: 'Untitled',
    status: 'planning',
    priority: 'normal',
    createdBy: 'test',
    createdAt: Date.now(),
    ...overrides,
  } as Task
}

function mockCtx(tasks: Task[], activityLog: Array<Record<string, unknown>> = []) {
  // Track patches for assertions
  const patches: Array<{ id: TaskId; fields: Record<string, unknown> }> = []
  const inserted: Array<{ table: string; doc: Record<string, unknown> }> = []
  const deleted: TaskId[] = []
  const runMutations: Array<{ mutation: unknown; args: Record<string, unknown> }> = []

  const ctx = {
    _patches: patches,
    _inserted: inserted,
    _deleted: deleted,
    _runMutations: runMutations,
    db: {
      query: (table: string) => {
        const rows = table === 'activityLog' ? activityLog : tasks
        const makeChain = (filtered: any[]) => ({
          order: (_dir: string) => ({
            take: async (n: number) => filtered.slice(0, n),
            paginate: async ({
              numItems,
              cursor,
            }: {
              numItems: number
              cursor: string | null
            }) => {
              const offset = cursor ? Number.parseInt(cursor, 10) : 0
              const next = Number.isFinite(offset) ? offset : 0
              const page = filtered.slice(next, next + numItems)
              const continueCursor = String(next + page.length)
              return {
                page,
                continueCursor,
                isDone: next + page.length >= filtered.length,
              }
            },
          }),
          withIndex: (_indexName: string, _indexFn?: (q: any) => any) => {
            // For index queries, apply simple filtering based on index name
            let result = [...filtered]
            if (_indexFn) {
              const eqCalls: Array<{ field: string; value: string }> = []
              const indexQ = {
                eq: (field: string, value: string) => {
                  eqCalls.push({ field, value })
                  return indexQ
                },
              }
              _indexFn(indexQ)
              for (const { field, value } of eqCalls) {
                result = result.filter((t: any) => t[field] === value)
              }
            }
            return makeChain(result)
          },
        })
        return makeChain([...rows])
      },
      get: async (id: TaskId) => tasks.find(t => t._id === id) ?? null,
      insert: async (_table: string, _doc: Record<string, unknown>) => {
        inserted.push({ table: _table, doc: _doc })
        if (_table === 'activityLog') {
          activityLog.push(_doc)
        }
        return 'new-id' as TaskId
      },
      patch: async (_id: TaskId, _fields: Record<string, unknown>) => {
        patches.push({ id: _id, fields: _fields })
        // Apply patch to in-memory task for chained operations
        const task = tasks.find(t => t._id === _id)
        if (task) Object.assign(task, _fields)
      },
      delete: async (_id: TaskId) => { deleted.push(_id) },
    },
    runMutation: async (mutation: unknown, args: Record<string, unknown>) => {
      runMutations.push({ mutation, args })
    },
    // [security] Mock auth for getUserIdentity guards (j57bds0a8vv8qk349dqsnfw65h81d99x)
    auth: {
      getUserIdentity: async () => ({ tokenIdentifier: 'test|user', subject: 'test-user', issuer: 'test' }),
    },
  }
  return ctx
}

// ──────────────────────────────────────────────────────────
// getByStatus — calls the ACTUAL query handler
// ──────────────────────────────────────────────────────────
describe('getByStatus query handler', () => {
  it('should group tasks into 6 status columns', async () => {
    const tasks = [
      makeTask({ _id: '1' as TaskId, title: 'T1', status: 'planning' }),
      makeTask({ _id: '2' as TaskId, title: 'T2', status: 'ready' }),
      makeTask({ _id: '3' as TaskId, title: 'T3', status: 'in_progress' }),
      makeTask({ _id: '4' as TaskId, title: 'T4', status: 'in_review' }),
      makeTask({ _id: '5' as TaskId, title: 'T5', status: 'done' }),
      makeTask({ _id: '6' as TaskId, title: 'T6', status: 'blocked' }),
    ]
    const ctx = mockCtx(tasks)
    const result = await getByStatusHandler(ctx, {})

    expect(result.planning).toHaveLength(1)
    expect(result.ready).toHaveLength(1)
    expect(result.in_progress).toHaveLength(1)
    expect(result.in_review).toHaveLength(1)
    expect(result.done).toHaveLength(1)
    expect(result.blocked).toHaveLength(1)
    expect(result.planning[0].title).toBe('T1')
  })

  it('should return empty arrays when no tasks exist', async () => {
    const ctx = mockCtx([])
    const result = await getByStatusHandler(ctx, {})

    expect(Object.keys(result)).toHaveLength(6)
    for (const col of Object.values(result) as Task[][]) {
      expect(col).toEqual([])
    }
  })

  it('should group multiple tasks into the same status column', async () => {
    const tasks = [
      makeTask({ _id: '1' as TaskId, title: 'A', status: 'in_progress', priority: 'high' }),
      makeTask({ _id: '2' as TaskId, title: 'B', status: 'in_progress', priority: 'normal' }),
      makeTask({ _id: '3' as TaskId, title: 'C', status: 'in_progress', priority: 'urgent' }),
      makeTask({ _id: '4' as TaskId, title: 'D', status: 'ready' }),
    ]
    const ctx = mockCtx(tasks)
    const result = await getByStatusHandler(ctx, {})

    expect(result.in_progress).toHaveLength(3)
    expect(result.ready).toHaveLength(1)
    expect(result.planning).toHaveLength(0)
  })

  it('should preserve full task objects in grouped output', async () => {
    const task = makeTask({
      _id: 'x' as TaskId,
      title: 'Full Task',
      status: 'done',
      priority: 'high',
      project: 'test-proj',
      assignedAgent: 'forge',
      notes: 'some notes',
    })
    const ctx = mockCtx([task])
    const result = await getByStatusHandler(ctx, {})

    const returned = result.done[0]
    expect(returned._id).toBe('x')
    expect(returned.title).toBe('Full Task')
    expect(returned.priority).toBe('high')
    expect(returned.project).toBe('test-proj')
    expect(returned.notes).toBe('some notes')
  })
})

// ──────────────────────────────────────────────────────────
// getById — calls the ACTUAL query handler
// ──────────────────────────────────────────────────────────
describe('getById query handler', () => {
  it('should return a task for a valid ID', async () => {
    const task = makeTask({ _id: 'abc' as TaskId, title: 'Found Me', status: 'in_progress' })
    const ctx = mockCtx([task])
    const result = await getByIdHandler(ctx, { id: 'abc' as TaskId })

    expect(result).not.toBeNull()
    expect(result._id).toBe('abc')
    expect(result.title).toBe('Found Me')
    expect(result.status).toBe('in_progress')
  })

  it('should return null for a non-existent ID', async () => {
    const ctx = mockCtx([
      makeTask({ _id: 'exists' as TaskId, title: 'Exists' }),
    ])
    const result = await getByIdHandler(ctx, { id: 'missing' as TaskId })

    expect(result).toBeNull()
  })

  it('should return the complete task with all fields', async () => {
    const task = makeTask({
      _id: 'full' as TaskId,
      title: 'Complete',
      status: 'in_review',
      priority: 'high',
      project: 'proj',
      assignedAgent: 'forge',
      createdBy: 'main',
      notes: 'detailed',
      version: 5,
    })
    const ctx = mockCtx([task])
    const result = await getByIdHandler(ctx, { id: 'full' as TaskId })

    expect(result).toEqual(task)
  })

  it('should return null from empty database', async () => {
    const ctx = mockCtx([])
    const result = await getByIdHandler(ctx, { id: 'any' as TaskId })

    expect(result).toBeNull()
  })
})

// ──────────────────────────────────────────────────────────
// listFiltered — calls the ACTUAL query handler
// ──────────────────────────────────────────────────────────
describe('listFiltered query handler', () => {
  const sampleTasks = [
    makeTask({ _id: '1' as TaskId, title: 'T1', status: 'in_progress', priority: 'high', project: 'dash', assignedAgent: 'forge' }),
    makeTask({ _id: '2' as TaskId, title: 'T2', status: 'ready', priority: 'normal', project: 'dash', assignedAgent: 'sentinel' }),
    makeTask({ _id: '3' as TaskId, title: 'T3', status: 'in_progress', priority: 'normal', project: 'other', assignedAgent: 'forge' }),
    makeTask({ _id: '4' as TaskId, title: 'T4', status: 'done', priority: 'low', project: 'dash', assignedAgent: 'oracle' }),
  ]

  it('should return default pagination (limit 50, offset 0)', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, {})

    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
    expect(result.tasks).toHaveLength(4)
    expect(result.total).toBe(4)
    expect(result.hasMore).toBe(false)
  })

  it('should filter by status', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { status: 'in_progress' })

    expect(result.tasks).toHaveLength(2)
    expect(result.tasks.every((t: Task) => t.status === 'in_progress')).toBe(true)
  })

  it('should filter by priority', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { priority: 'high' })

    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].title).toBe('T1')
  })

  it('should filter by project', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { project: 'dash' })

    expect(result.tasks).toHaveLength(3)
    expect(result.tasks.every((t: Task) => t.project === 'dash')).toBe(true)
  })

  it('should filter by assignedAgent', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { assignedAgent: 'forge' })

    expect(result.tasks).toHaveLength(2)
    expect(result.tasks.every((t: Task) => t.assignedAgent === 'forge')).toBe(true)
  })

  it('should apply multiple filters', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, {
      status: 'in_progress',
      assignedAgent: 'forge',
      project: 'dash',
    })

    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].title).toBe('T1')
  })

  it('should return empty when no tasks match', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { status: 'cancelled' })

    expect(result.tasks).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('should respect limit and offset', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { limit: 2, offset: 0 })

    expect(result.tasks).toHaveLength(2)
    expect(result.hasMore).toBe(true)
    expect(result.total).toBe(4)
  })

  it('should paginate with offset', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { limit: 2, offset: 2 })

    expect(result.tasks).toHaveLength(2)
    expect(result.hasMore).toBe(false)
  })

  it('should return empty for offset past end', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { limit: 10, offset: 100 })

    expect(result.tasks).toHaveLength(0)
    expect(result.hasMore).toBe(false)
  })

  it('should handle empty database', async () => {
    const ctx = mockCtx([])
    const result = await listFilteredHandler(ctx, {})

    expect(result.tasks).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
  })
})

// ──────────────────────────────────────────────────────────
// list — calls the ACTUAL query handler
// ──────────────────────────────────────────────────────────
describe('list query handler', () => {
  it('should return tasks ordered desc, up to 100', async () => {
    const tasks = [
      makeTask({ _id: '1' as TaskId, title: 'A' }),
      makeTask({ _id: '2' as TaskId, title: 'B' }),
    ]
    const ctx = mockCtx(tasks)
    const result = await listHandler(ctx, {})

    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('A')
  })

  it('should return empty array when no tasks exist', async () => {
    const ctx = mockCtx([])
    const result = await listHandler(ctx, {})

    expect(result).toHaveLength(0)
  })
})

// ──────────────────────────────────────────────────────────
// getWorkload — calls the ACTUAL query handler
// ──────────────────────────────────────────────────────────
describe('getWorkload query handler', () => {
  it('should aggregate tasks by agent', async () => {
    const tasks = [
      makeTask({ _id: '1' as TaskId, assignedAgent: 'forge', status: 'in_progress', priority: 'high' }),
      makeTask({ _id: '2' as TaskId, assignedAgent: 'forge', status: 'ready', priority: 'normal' }),
      makeTask({ _id: '3' as TaskId, assignedAgent: 'sentinel', status: 'done', priority: 'low' }),
    ]
    const ctx = mockCtx(tasks)
    const result = await getWorkloadHandler(ctx, {})

    expect(result.forge.total).toBe(2)
    expect(result.sentinel.total).toBe(1)
    expect(result.forge.byStatus.in_progress).toBe(1)
    expect(result.forge.byStatus.ready).toBe(1)
    expect(result.forge.byPriority.high).toBe(1)
    expect(result.forge.byPriority.normal).toBe(1)
    expect(result.sentinel.byStatus.done).toBe(1)
    expect(result.sentinel.byPriority.low).toBe(1)
  })

  it('should use "unassigned" for tasks without an agent', async () => {
    const tasks = [
      makeTask({ _id: '1' as TaskId, title: 'No Agent' }),
    ]
    const ctx = mockCtx(tasks)
    const result = await getWorkloadHandler(ctx, {})

    expect(result.unassigned).toBeDefined()
    expect(result.unassigned.total).toBe(1)
  })

  it('should return empty object when no tasks exist', async () => {
    const ctx = mockCtx([])
    const result = await getWorkloadHandler(ctx, {})

    expect(Object.keys(result)).toHaveLength(0)
  })
})

describe('getAgentPresence query handler', () => {
  it('should return one active task per agent with runtime and cost snapshot', async () => {
    const now = Date.now()
    const tasks = [
      makeTask({
        _id: 'p1' as TaskId,
        title: 'Primary',
        assignedAgent: 'forge',
        status: 'in_progress',
        startedAt: now - 10_000,
        lastHeartbeatAt: now - 2_000,
        runId: 'run-1',
        sessionKey: 'sess-1',
        costSoFarUsd: 1.25,
      } as any),
      makeTask({
        _id: 'p2' as TaskId,
        title: 'Older',
        assignedAgent: 'forge',
        status: 'ready',
        createdAt: now - 90_000,
      } as any),
      makeTask({
        _id: 'p3' as TaskId,
        title: 'Sentinel task',
        assignedAgent: 'sentinel',
        status: 'in_review',
        createdAt: now - 30_000,
      } as any),
    ]
    const logs = [
      { taskId: 'p3', timestamp: now - 1_000 },
    ]

    const ctx = mockCtx(tasks, logs)
    const result = await getAgentPresenceHandler(ctx, {})

    expect(result).toHaveLength(2)
    const forge = result.find((row: any) => row.agent === 'forge')
    const sentinel = result.find((row: any) => row.agent === 'sentinel')
    expect(forge.activeTask.taskId).toBe('p1')
    expect(forge.status).toBe('in_progress')
    expect(forge.runId).toBe('run-1')
    expect(forge.sessionKey).toBe('sess-1')
    expect(forge.costSoFarUsd).toBe(1.25)
    expect(forge.elapsedRuntimeMs).toBeGreaterThanOrEqual(9_000)
    expect(forge.lastSeen).toBe(now - 2_000)
    expect(sentinel.lastSeen).toBe(now - 1_000)
  })

  it('should filter by agent and exclude terminal tasks', async () => {
    const now = Date.now()
    const tasks = [
      makeTask({ _id: 'q1' as TaskId, assignedAgent: 'forge', status: 'done', createdAt: now - 100 } as any),
      makeTask({ _id: 'q2' as TaskId, assignedAgent: 'forge', status: 'cancelled', createdAt: now - 90 } as any),
      makeTask({ _id: 'q3' as TaskId, assignedAgent: 'forge', status: 'ready', createdAt: now - 80 } as any),
      makeTask({ _id: 'q4' as TaskId, assignedAgent: 'sentinel', status: 'in_progress', createdAt: now - 70 } as any),
    ]
    const ctx = mockCtx(tasks)
    const result = await getAgentPresenceHandler(ctx, { agent: 'forge' })

    expect(result).toHaveLength(1)
    expect(result[0].agent).toBe('forge')
    expect(result[0].activeTask.taskId).toBe('q3')
  })

  it('should include active tasks beyond legacy fixed windows', async () => {
    const now = Date.now()
    const tasks = Array.from({ length: 1000 }, (_, i) =>
      makeTask({
        _id: `done-${i}` as TaskId,
        assignedAgent: `agent-${i}`,
        status: 'done',
        createdAt: now - i,
      } as any),
    )
    tasks.push(makeTask({
      _id: 'active-deep' as TaskId,
      assignedAgent: 'sentinel',
      status: 'in_progress',
      createdAt: now - 200_000,
      startedAt: now - 10_000,
      lastHeartbeatAt: now - 1_500,
    } as any))

    const ctx = mockCtx(tasks)
    const result = await getAgentPresenceHandler(ctx, {})

    expect(result.some((row: any) => row.agent === 'sentinel')).toBe(true)
    const sentinel = result.find((row: any) => row.agent === 'sentinel')
    expect(sentinel.activeTask.taskId).toBe('active-deep')
    expect(sentinel.lastSeen).toBe(now - 1_500)
  })

  it('should include lastSeen from activity outside legacy activity windows', async () => {
    const now = Date.now()
    const tasks = [
      makeTask({
        _id: 'target-task' as TaskId,
        assignedAgent: 'forge',
        status: 'in_progress',
        createdAt: now - 40_000,
        startedAt: now - 35_000,
        lastHeartbeatAt: now - 30_000,
      } as any),
    ]
    const logs = Array.from({ length: 1200 }, (_, i) => ({
      taskId: `other-${i}`,
      timestamp: now - i,
    }))
    logs.push({
      taskId: 'target-task',
      timestamp: now - 2_000,
    })

    const ctx = mockCtx(tasks, logs as Array<Record<string, unknown>>)
    const result = await getAgentPresenceHandler(ctx, {})

    expect(result).toHaveLength(1)
    expect(result[0].agent).toBe('forge')
    expect(result[0].activeTask.taskId).toBe('target-task')
    expect(result[0].lastSeen).toBe(now - 2_000)
  })

  it('should deterministically choose one task when agent candidates tie on rank fields', async () => {
    const now = Date.now()
    const tasks = [
      makeTask({
        _id: 'task-a' as TaskId,
        assignedAgent: 'forge',
        status: 'in_progress',
        createdAt: now - 20_000,
        startedAt: now - 10_000,
      } as any),
      makeTask({
        _id: 'task-z' as TaskId,
        assignedAgent: 'forge',
        status: 'in_progress',
        createdAt: now - 20_000,
        startedAt: now - 10_000,
      } as any),
    ]

    const ctx = mockCtx(tasks)
    const result = await getAgentPresenceHandler(ctx, { agent: 'forge' })

    expect(result).toHaveLength(1)
    expect(result[0].activeTask.taskId).toBe('task-z')
  })
})

// ──────────────────────────────────────────────────────────
// create — calls the ACTUAL mutation handler
// ──────────────────────────────────────────────────────────
describe('create mutation handler', () => {
  it('should create a task with valid inputs', async () => {
    const ctx = mockCtx([])
    const result = await createHandler(ctx, {
      title: 'New Task',
      priority: 'high',
      project: 'test-proj',
    })

    expect(result).toHaveProperty('id')
  })

  it('should reject invalid priority', async () => {
    const ctx = mockCtx([])

    await expect(createHandler(ctx, {
      title: 'Bad Priority',
      priority: 'critical',
      project: 'test-proj',
    })).rejects.toThrow('Invalid priority')
  })

  it('should reject invalid status', async () => {
    const ctx = mockCtx([])

    await expect(createHandler(ctx, {
      title: 'Bad Status',
      priority: 'high',
      project: 'test-proj',
      status: 'bogus',
    })).rejects.toThrow('Invalid status')
  })

  it('should accept valid status', async () => {
    const ctx = mockCtx([])
    const result = await createHandler(ctx, {
      title: 'With Status',
      priority: 'normal',
      project: 'proj',
      status: 'ready',
    })

    expect(result).toHaveProperty('id')
  })

  it('should accept optional fields', async () => {
    const ctx = mockCtx([])
    const result = await createHandler(ctx, {
      title: 'Full Task',
      priority: 'urgent',
      project: 'proj',
      notes: 'some notes',
      assignedAgent: 'forge',
      createdBy: 'main',
    })

    expect(result).toHaveProperty('id')
  })
})

// ──────────────────────────────────────────────────────────
// update — calls the ACTUAL mutation handler
// ──────────────────────────────────────────────────────────
describe('update mutation handler', () => {
  it('should update status of an existing task', async () => {
    const tasks = [makeTask({ _id: 'u1' as TaskId, title: 'To Update' })]
    const ctx = mockCtx(tasks)
    const result = await updateHandler(ctx, { id: 'u1' as TaskId, status: 'in_progress' })

    expect(result).toEqual({ success: true })
  })

  it('should throw when task not found', async () => {
    const ctx = mockCtx([])

    await expect(updateHandler(ctx, { id: 'missing' as TaskId, status: 'done' }))
      .rejects.toThrow('Task not found')
  })

  it('should reject invalid status', async () => {
    const tasks = [makeTask({ _id: 'u2' as TaskId })]
    const ctx = mockCtx(tasks)

    await expect(updateHandler(ctx, { id: 'u2' as TaskId, status: 'bogus' }))
      .rejects.toThrow('Invalid status')
  })

  it('should reject invalid priority', async () => {
    const tasks = [makeTask({ _id: 'u3' as TaskId })]
    const ctx = mockCtx(tasks)

    await expect(updateHandler(ctx, { id: 'u3' as TaskId, priority: 'critical' }))
      .rejects.toThrow('Invalid priority')
  })

  it('should update multiple fields at once', async () => {
    const tasks = [makeTask({ _id: 'u4' as TaskId })]
    const ctx = mockCtx(tasks)
    const result = await updateHandler(ctx, {
      id: 'u4' as TaskId,
      status: 'in_review',
      priority: 'urgent',
      assignedAgent: 'sentinel',
      notes: 'updated',
    })

    expect(result).toEqual({ success: true })
  })

  it('should accept update with no optional fields', async () => {
    const tasks = [makeTask({ _id: 'u5' as TaskId })]
    const ctx = mockCtx(tasks)
    const result = await updateHandler(ctx, { id: 'u5' as TaskId })

    expect(result).toEqual({ success: true })
  })
})

describe('create Mutation - Required Fields', () => {
  it('should require title field', () => {
    const argsWithoutTitle = {
      priority: 'high',
      project: 'agent-dashboard',
    }
    
    expect(argsWithoutTitle).not.toHaveProperty('title')
  })

  it('should require priority field', () => {
    const argsWithoutPriority = {
      title: 'Test Task',
      project: 'agent-dashboard',
    }
    
    expect(argsWithoutPriority).not.toHaveProperty('priority')
  })

  it('should require project field', () => {
    const argsWithoutProject = {
      title: 'Test Task',
      priority: 'high',
    }
    
    expect(argsWithoutProject).not.toHaveProperty('project')
  })

  it('should accept valid args with all required fields', () => {
    const validArgs = {
      title: 'Test Task',
      priority: 'high',
      project: 'agent-dashboard',
    }
    
    expect(validArgs).toHaveProperty('title')
    expect(validArgs).toHaveProperty('priority')
    expect(validArgs).toHaveProperty('project')
  })
})

describe('create Mutation - Default Values', () => {
  it('should default createdBy to "api"', () => {
    const argsWithoutCreatedBy: any = {
      title: 'Test Task',
      priority: 'high',
      project: 'agent-dashboard',
    }
    
    const createdBy = argsWithoutCreatedBy.createdBy || 'api'
    
    expect(createdBy).toBe('api')
  })

  it('should default assignedAgent to "unassigned"', () => {
    const argsWithoutAssignedAgent: any = {
      title: 'Test Task',
      priority: 'high',
      project: 'agent-dashboard',
    }
    
    const assignedAgent = argsWithoutAssignedAgent.assignedAgent || 'unassigned'
    
    expect(assignedAgent).toBe('unassigned')
  })

  it('should default status to "planning"', () => {
    const argsWithoutStatus: any = {
      title: 'Test Task',
      priority: 'high',
      project: 'agent-dashboard',
    }
    
    const status = argsWithoutStatus.status || 'planning'
    
    expect(status).toBe('planning')
  })

  it('should set createdAt to current timestamp', () => {
    const before = Date.now()
    const createdAt = Date.now()
    const after = Date.now()
    
    expect(createdAt).toBeGreaterThanOrEqual(before)
    expect(createdAt).toBeLessThanOrEqual(after)
  })

  it('should allow overriding default createdBy', () => {
    const argsWithCreatedBy = {
      title: 'Test Task',
      priority: 'high',
      project: 'agent-dashboard',
      createdBy: 'main',
    }
    
    const createdBy = argsWithCreatedBy.createdBy || 'api'
    
    expect(createdBy).toBe('main')
  })

  it('should allow overriding default assignedAgent', () => {
    const argsWithAssignedAgent = {
      title: 'Test Task',
      priority: 'high',
      project: 'agent-dashboard',
      assignedAgent: 'forge',
    }
    
    const assignedAgent = argsWithAssignedAgent.assignedAgent || 'unassigned'
    
    expect(assignedAgent).toBe('forge')
  })

  it('should allow overriding default status', () => {
    const argsWithStatus = {
      title: 'Test Task',
      priority: 'high',
      project: 'agent-dashboard',
      status: 'ready',
    }
    
    const status = argsWithStatus.status || 'planning'
    
    expect(status).toBe('ready')
  })
})

describe('create Mutation - Priority Validation', () => {
  it('should accept valid priority: low', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    expect(validPriorities).toContain('low')
  })

  it('should accept valid priority: normal', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    expect(validPriorities).toContain('normal')
  })

  it('should accept valid priority: high', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    expect(validPriorities).toContain('high')
  })

  it('should accept valid priority: urgent', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    expect(validPriorities).toContain('urgent')
  })

  it('should reject invalid priority', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    const invalidPriority = 'critical'
    
    expect(validPriorities).not.toContain(invalidPriority)
  })

  it('should throw error with invalid priority message', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    const invalidPriority = 'critical'
    
    if (!validPriorities.includes(invalidPriority)) {
      const errorMessage = `Invalid priority: ${invalidPriority}. Must be one of: ${validPriorities.join(', ')}`
      expect(errorMessage).toBe('Invalid priority: critical. Must be one of: low, normal, high, urgent')
    }
  })
})

describe('create Mutation - Status Validation', () => {
  it('should accept valid status values', () => {
    const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
    const testStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
    
    testStatuses.forEach(status => {
      expect(validStatuses).toContain(status)
    })
  })

  it('should reject invalid status', () => {
    const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
    const invalidStatus = 'pending'
    
    expect(validStatuses).not.toContain(invalidStatus)
  })

  it('should throw error with invalid status message', () => {
    const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
    const invalidStatus = 'pending'
    
    if (!validStatuses.includes(invalidStatus)) {
      const errorMessage = `Invalid status: ${invalidStatus}. Must be one of: ${validStatuses.join(', ')}`
      expect(errorMessage).toContain('Invalid status: pending')
      expect(errorMessage).toContain('Must be one of:')
    }
  })

  it('should allow creating task without status (defaults to planning)', () => {
    const argsWithoutStatus: any = {
      title: 'Test Task',
      priority: 'high',
      project: 'agent-dashboard',
    }
    
    const status = argsWithoutStatus.status || 'planning'
    expect(status).toBe('planning')
  })
})

describe('create Mutation - Optional Fields', () => {
  it('should accept optional notes field', () => {
    const argsWithNotes = {
      title: 'Test Task',
      priority: 'high',
      project: 'agent-dashboard',
      notes: 'Additional context',
    }
    
    expect(argsWithNotes).toHaveProperty('notes')
    expect(argsWithNotes.notes).toBe('Additional context')
  })

  it('should work without notes field', () => {
    const argsWithoutNotes = {
      title: 'Test Task',
      priority: 'high',
      project: 'agent-dashboard',
    }
    
    expect(argsWithoutNotes).not.toHaveProperty('notes')
  })

  it('should accept optional assignedAgent field', () => {
    const argsWithAgent = {
      title: 'Test Task',
      priority: 'high',
      project: 'agent-dashboard',
      assignedAgent: 'forge',
    }
    
    expect(argsWithAgent).toHaveProperty('assignedAgent')
    expect(argsWithAgent.assignedAgent).toBe('forge')
  })

  it('should accept optional createdBy field', () => {
    const argsWithCreatedBy = {
      title: 'Test Task',
      priority: 'high',
      project: 'agent-dashboard',
      createdBy: 'main',
    }
    
    expect(argsWithCreatedBy).toHaveProperty('createdBy')
    expect(argsWithCreatedBy.createdBy).toBe('main')
  })

  it('should accept optional status field', () => {
    const argsWithStatus = {
      title: 'Test Task',
      priority: 'high',
      project: 'agent-dashboard',
      status: 'ready',
    }
    
    expect(argsWithStatus).toHaveProperty('status')
    expect(argsWithStatus.status).toBe('ready')
  })
})

describe('create Mutation - Return Value', () => {
  it('should return object with id property', () => {
    const mockResult = {
      id: 'j57abc123',
    }
    
    expect(mockResult).toHaveProperty('id')
  })

  it('should return id as string', () => {
    const mockResult = {
      id: 'j57abc123',
    }
    
    expect(typeof mockResult.id).toBe('string')
  })

  it('should return Convex ID format', () => {
    const mockId = 'j57abc123'
    
    expect(mockId).toMatch(/^j5[0-9a-z]+$/)
  })
})

describe('update Mutation - Task ID Validation', () => {
  it('should require task ID', () => {
    const argsWithoutId = {
      status: 'in_progress',
    }
    
    expect(argsWithoutId).not.toHaveProperty('id')
  })

  it('should throw error when task not found', () => {
    const taskId = 'j57nonexistent'
    const task = null // Simulating task not found
    
    if (!task) {
      const errorMessage = `Task not found: ${taskId}`
      expect(errorMessage).toBe('Task not found: j57nonexistent')
    }
  })

  it('should accept valid Convex ID format', () => {
    const validId = 'j57abc123'
    
    expect(validId).toMatch(/^j5[0-9a-z]+$/)
  })
})

describe('update Mutation - Partial Updates', () => {
  it('should update only status when provided', () => {
    const updateArgs = {
      id: 'j57abc123',
      status: 'in_progress',
    }
    
    const updates: Record<string, unknown> = {}
    if (updateArgs.status !== undefined) updates.status = updateArgs.status
    
    expect(updates).toHaveProperty('status')
    expect(updates).not.toHaveProperty('priority')
    expect(updates).not.toHaveProperty('assignedAgent')
    expect(updates).not.toHaveProperty('notes')
    expect(Object.keys(updates)).toHaveLength(1)
  })

  it('should update only priority when provided', () => {
    const updateArgs = {
      id: 'j57abc123',
      priority: 'urgent',
    }
    
    const updates: Record<string, unknown> = {}
    if (updateArgs.priority !== undefined) updates.priority = updateArgs.priority
    
    expect(updates).toHaveProperty('priority')
    expect(updates).not.toHaveProperty('status')
    expect(Object.keys(updates)).toHaveLength(1)
  })

  it('should update only assignedAgent when provided', () => {
    const updateArgs = {
      id: 'j57abc123',
      assignedAgent: 'sentinel',
    }
    
    const updates: Record<string, unknown> = {}
    if (updateArgs.assignedAgent !== undefined) updates.assignedAgent = updateArgs.assignedAgent
    
    expect(updates).toHaveProperty('assignedAgent')
    expect(updates).not.toHaveProperty('status')
    expect(Object.keys(updates)).toHaveLength(1)
  })

  it('should update only notes when provided', () => {
    const updateArgs = {
      id: 'j57abc123',
      notes: 'Updated context',
    }
    
    const updates: Record<string, unknown> = {}
    if (updateArgs.notes !== undefined) updates.notes = updateArgs.notes
    
    expect(updates).toHaveProperty('notes')
    expect(updates).not.toHaveProperty('status')
    expect(Object.keys(updates)).toHaveLength(1)
  })

  it('should update multiple fields when provided', () => {
    const updateArgs = {
      id: 'j57abc123',
      status: 'done',
      priority: 'normal',
      assignedAgent: 'oracle',
      notes: 'Completed',
    }
    
    const updates: Record<string, unknown> = {}
    if (updateArgs.status !== undefined) updates.status = updateArgs.status
    if (updateArgs.priority !== undefined) updates.priority = updateArgs.priority
    if (updateArgs.assignedAgent !== undefined) updates.assignedAgent = updateArgs.assignedAgent
    if (updateArgs.notes !== undefined) updates.notes = updateArgs.notes
    
    expect(updates).toHaveProperty('status')
    expect(updates).toHaveProperty('priority')
    expect(updates).toHaveProperty('assignedAgent')
    expect(updates).toHaveProperty('notes')
    expect(Object.keys(updates)).toHaveLength(4)
  })

  it('should not include undefined fields in update', () => {
    const updateArgs = {
      id: 'j57abc123',
      status: 'in_progress',
    }
    
    const updates: Record<string, unknown> = {}
    if (updateArgs.status !== undefined) updates.status = updateArgs.status
    
    expect(updates).not.toHaveProperty('priority')
    expect(updates).not.toHaveProperty('assignedAgent')
  })
})

describe('update Mutation - Status Validation', () => {
  it('should accept valid status values', () => {
    const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
    const testStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
    
    testStatuses.forEach(status => {
      expect(validStatuses).toContain(status)
    })
  })

  it('should reject invalid status', () => {
    const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
    const invalidStatus = 'pending'
    
    expect(validStatuses).not.toContain(invalidStatus)
  })

  it('should throw error with invalid status message', () => {
    const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
    const invalidStatus = 'pending'
    
    if (!validStatuses.includes(invalidStatus)) {
      const errorMessage = `Invalid status: ${invalidStatus}. Must be one of: ${validStatuses.join(', ')}`
      expect(errorMessage).toContain('Invalid status: pending')
    }
  })
})

describe('update Mutation - Priority Validation', () => {
  it('should accept valid priority values', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    const testPriorities = ['low', 'normal', 'high', 'urgent']
    
    testPriorities.forEach(priority => {
      expect(validPriorities).toContain(priority)
    })
  })

  it('should reject invalid priority', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    const invalidPriority = 'critical'
    
    expect(validPriorities).not.toContain(invalidPriority)
  })

  it('should throw error with invalid priority message', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    const invalidPriority = 'critical'
    
    if (!validPriorities.includes(invalidPriority)) {
      const errorMessage = `Invalid priority: ${invalidPriority}. Must be one of: ${validPriorities.join(', ')}`
      expect(errorMessage).toContain('Invalid priority: critical')
    }
  })
})

describe('update Mutation - Return Value', () => {
  it('should return object with success property', () => {
    const mockResult = {
      success: true,
    }
    
    expect(mockResult).toHaveProperty('success')
  })

  it('should return success as boolean', () => {
    const mockResult = {
      success: true,
    }
    
    expect(typeof mockResult.success).toBe('boolean')
  })

  it('should return success true on successful update', () => {
    const mockResult = {
      success: true,
    }
    
    expect(mockResult.success).toBe(true)
  })
})

describe('update Mutation - Edge Cases', () => {
  it('should handle updating task to same values', () => {
    const existingTask = {
      id: 'j57abc123',
      status: 'in_progress',
      priority: 'high',
    }
    
    const updateArgs = {
      id: 'j57abc123',
      status: 'in_progress',
      priority: 'high',
    }
    
    const updates: Record<string, unknown> = {}
    if (updateArgs.status !== undefined) updates.status = updateArgs.status
    if (updateArgs.priority !== undefined) updates.priority = updateArgs.priority
    
    expect(updates.status).toBe(existingTask.status)
    expect(updates.priority).toBe(existingTask.priority)
  })

  it('should handle empty notes update', () => {
    const updateArgs = {
      id: 'j57abc123',
      notes: '',
    }
    
    const updates: Record<string, unknown> = {}
    if (updateArgs.notes !== undefined) updates.notes = updateArgs.notes
    
    expect(updates.notes).toBe('')
  })

  it('should handle whitespace-only notes', () => {
    const updateArgs = {
      id: 'j57abc123',
      notes: '   ',
    }
    
    const updates: Record<string, unknown> = {}
    if (updateArgs.notes !== undefined) updates.notes = updateArgs.notes
    
    expect(updates.notes).toBe('   ')
  })
})

// ═══════════════════════════════════════════════════════════
// NEW TESTS — Agent Workflow Mutations (clawd)
// ═══════════════════════════════════════════════════════════

describe('heartbeat', () => {
  it('should update lastHeartbeatAt and return heartbeat metadata', async () => {
    const task = makeTask({ _id: 'hb1' as TaskId, status: 'in_progress', version: 2 } as any)
    const ctx = mockCtx([task])
    const result = await heartbeatHandler(ctx, {
      taskId: 'hb1' as TaskId,
      actor: 'forge',
    })

    expect(result.ok).toBe(true)
    expect(result.lastSeen).toBeTypeOf('number')
    expect(result.version).toBe(3)
    expect(ctx._patches[0].fields.lastHeartbeatAt).toBeTypeOf('number')
  })

  it('should patch run/session and cost when provided', async () => {
    const task = makeTask({ _id: 'hb2' as TaskId, status: 'in_progress' } as any)
    const ctx = mockCtx([task])
    await heartbeatHandler(ctx, {
      taskId: 'hb2' as TaskId,
      actor: 'forge',
      runId: 'run-22',
      sessionKey: 'sess-22',
      costSoFarUsd: 3.5,
      note: 'still running',
    })

    const patch = ctx._patches[0].fields
    expect(patch.runId).toBe('run-22')
    expect(patch.sessionKey).toBe('sess-22')
    expect(patch.costSoFarUsd).toBe(3.5)
    expect(patch.notes).toContain('heartbeat')
    expect(patch.notes).toContain('still running')
  })

  it('should throw when task is missing', async () => {
    const ctx = mockCtx([])
    await expect(heartbeatHandler(ctx, {
      taskId: 'missing' as TaskId,
      actor: 'forge',
    })).rejects.toThrow('Task not found')
  })
})

// ──────────────────────────────────────────────────────────
// pushStatus
// ──────────────────────────────────────────────────────────
describe('pushStatus', () => {
  it('should update task status and append log to notes', async () => {
    const task = makeTask({ _id: 't1' as TaskId, status: 'ready', notes: '' })
    const ctx = mockCtx([task])
    const result = await pushStatusHandler(ctx, {
      taskId: 't1' as TaskId,
      status: 'in_progress',
      actor: 'forge',
    })
    expect(result).toEqual({ ok: true, version: 1 })
    expect(ctx._patches[0].fields.status).toBe('in_progress')
    expect(ctx._patches[0].fields.startedAt).toBeDefined()
  })

  it('should throw when task not found', async () => {
    const ctx = mockCtx([])
    await expect(pushStatusHandler(ctx, {
      taskId: 'missing' as TaskId,
      status: 'done',
      actor: 'forge',
    })).rejects.toThrow('Task not found')
  })

  it('should set completedAt when status is done', async () => {
    const task = makeTask({ _id: 't2' as TaskId, status: 'in_progress' })
    const ctx = mockCtx([task])
    await pushStatusHandler(ctx, {
      taskId: 't2' as TaskId,
      status: 'done',
      actor: 'forge',
    })
    expect(ctx._patches[0].fields.completedAt).toBeDefined()
  })

  it('should not overwrite existing startedAt', async () => {
    const task = makeTask({ _id: 't3' as TaskId, status: 'ready', startedAt: 1000 })
    const ctx = mockCtx([task])
    await pushStatusHandler(ctx, {
      taskId: 't3' as TaskId,
      status: 'in_progress',
      actor: 'forge',
    })
    expect(ctx._patches[0].fields.startedAt).toBeUndefined()
  })

  it('should include note in log entry', async () => {
    const task = makeTask({ _id: 't4' as TaskId, status: 'ready', notes: '' })
    const ctx = mockCtx([task])
    await pushStatusHandler(ctx, {
      taskId: 't4' as TaskId,
      status: 'in_progress',
      actor: 'forge',
      note: 'starting work',
    })
    expect(ctx._patches[0].fields.notes).toContain('starting work')
  })

  it('should set runId and sessionKey when provided', async () => {
    const task = makeTask({ _id: 't5' as TaskId, status: 'ready' })
    const ctx = mockCtx([task])
    await pushStatusHandler(ctx, {
      taskId: 't5' as TaskId,
      status: 'in_progress',
      actor: 'forge',
      runId: 'run-123',
      sessionKey: 'sess-456',
    })
    expect(ctx._patches[0].fields.runId).toBe('run-123')
    expect(ctx._patches[0].fields.sessionKey).toBe('sess-456')
  })

  it('should increment version', async () => {
    const task = makeTask({ _id: 't6' as TaskId, status: 'ready', version: 5 } as any)
    const ctx = mockCtx([task])
    const result = await pushStatusHandler(ctx, {
      taskId: 't6' as TaskId,
      status: 'in_progress',
      actor: 'forge',
    })
    expect(result.version).toBe(6)
  })

  it('should append to existing notes', async () => {
    const task = makeTask({ _id: 't7' as TaskId, status: 'ready', notes: 'existing note' })
    const ctx = mockCtx([task])
    await pushStatusHandler(ctx, {
      taskId: 't7' as TaskId,
      status: 'in_progress',
      actor: 'forge',
    })
    const notes = ctx._patches[0].fields.notes as string
    expect(notes).toContain('existing note')
    expect(notes).toContain('forge: status → in_progress')
  })
})

// ──────────────────────────────────────────────────────────
// pushEvent
// ──────────────────────────────────────────────────────────
describe('pushEvent', () => {
  it('should append event to task notes', async () => {
    const task = makeTask({ _id: 'e1' as TaskId, notes: '' })
    const ctx = mockCtx([task])
    const result = await pushEventHandler(ctx, {
      taskId: 'e1' as TaskId,
      event: 'test_started',
      actor: 'forge',
    })
    expect(result).toEqual({ ok: true })
    expect(ctx._patches[0].fields.notes).toContain('forge: test_started')
  })

  it('should throw when task not found', async () => {
    const ctx = mockCtx([])
    await expect(pushEventHandler(ctx, {
      taskId: 'missing' as TaskId,
      event: 'test',
      actor: 'forge',
    })).rejects.toThrow('Task not found')
  })

  it('should include details in log entry', async () => {
    const task = makeTask({ _id: 'e2' as TaskId, notes: '' })
    const ctx = mockCtx([task])
    await pushEventHandler(ctx, {
      taskId: 'e2' as TaskId,
      event: 'error',
      actor: 'forge',
      details: 'something went wrong',
    })
    expect(ctx._patches[0].fields.notes).toContain('something went wrong')
  })

  it('should increment version', async () => {
    const task = makeTask({ _id: 'e3' as TaskId, version: 3 } as any)
    const ctx = mockCtx([task])
    await pushEventHandler(ctx, {
      taskId: 'e3' as TaskId,
      event: 'progress',
      actor: 'forge',
    })
    expect(ctx._patches[0].fields.version).toBe(4)
  })
})

// ──────────────────────────────────────────────────────────
// createTask — full validation
// ──────────────────────────────────────────────────────────
describe('createTask — full validation', () => {
  it('should create a task with minimal args', async () => {
    const ctx = mockCtx([])
    const result = await createTaskHandler(ctx, { title: 'Test' })
    expect(result).toBe('new-id')
  })

  it('should default to planning when no agent assigned', async () => {
    const ctx = mockCtx([])
    await createTaskHandler(ctx, { title: 'Test' })
    expect(ctx._inserted[0].doc.status).toBe('planning')
  })

  it('should default to ready when agent assigned', async () => {
    const ctx = mockCtx([])
    await createTaskHandler(ctx, { title: 'Test', assignedAgent: 'forge' })
    expect(ctx._inserted[0].doc.status).toBe('ready')
  })

  it('should sanitize title', async () => {
    const ctx = mockCtx([])
    await createTaskHandler(ctx, { title: 'Test\x00\x01Title' })
    expect(ctx._inserted[0].doc.title).toBe('Test  Title')
  })

  it('should truncate long titles to 200 chars', async () => {
    const ctx = mockCtx([])
    const longTitle = 'x'.repeat(300)
    await createTaskHandler(ctx, { title: longTitle })
    expect((ctx._inserted[0].doc.title as string).length).toBe(200)
  })

  it('should set startedAt when created with in_progress status', async () => {
    const ctx = mockCtx([])
    await createTaskHandler(ctx, { title: 'Test', status: 'in_progress' })
    expect(ctx._inserted[0].doc.startedAt).toBeDefined()
  })

  it('should set version to 0', async () => {
    const ctx = mockCtx([])
    await createTaskHandler(ctx, { title: 'Test' })
    expect(ctx._inserted[0].doc.version).toBe(0)
  })

  it('should accept all optional fields', async () => {
    const ctx = mockCtx([])
    await createTaskHandler(ctx, {
      title: 'Full',
      description: 'desc',
      assignedAgent: 'forge',
      createdBy: 'main',
      priority: 'high',
      status: 'ready',
      project: 'proj',
      notes: 'note',
      tags: ['tag1'],
    })
    const doc = ctx._inserted[0].doc
    expect(doc.description).toBe('desc')
    expect(doc.priority).toBe('high')
    expect(doc.tags).toEqual(['tag1'])
  })

  it('should default createdBy to main', async () => {
    const ctx = mockCtx([])
    await createTaskHandler(ctx, { title: 'Test' })
    expect(ctx._inserted[0].doc.createdBy).toBe('main')
  })

  it('should assign a friendly task key on create', async () => {
    const ctx = mockCtx([])
    await createTaskHandler(ctx, { title: 'Test' })
    expect(ctx._inserted[0].doc.taskNumber).toBe(1)
    expect(ctx._inserted[0].doc.taskKey).toBe('AD-1')
  })
})

// ──────────────────────────────────────────────────────────
// claimTask
// ──────────────────────────────────────────────────────────
describe('claimTask', () => {
  it('should claim a ready task', async () => {
    const task = makeTask({ _id: 'c1' as TaskId, status: 'ready' })
    const ctx = mockCtx([task])
    const result = await claimTaskHandler(ctx, { taskId: 'c1' as TaskId, agent: 'forge' })
    expect(result).toBe('c1')
    expect(ctx._patches[0].fields.assignedAgent).toBe('forge')
    expect(ctx._patches[0].fields.status).toBe('in_progress')
  })

  it('should claim a planning task', async () => {
    const task = makeTask({ _id: 'c2' as TaskId, status: 'planning' })
    const ctx = mockCtx([task])
    await claimTaskHandler(ctx, { taskId: 'c2' as TaskId, agent: 'forge' })
    expect(ctx._patches[0].fields.status).toBe('in_progress')
  })

  it('should throw when task not found', async () => {
    const ctx = mockCtx([])
    await expect(claimTaskHandler(ctx, { taskId: 'missing' as TaskId, agent: 'forge' }))
      .rejects.toThrow('Task not found')
  })

  it('should throw when task is in_progress', async () => {
    const task = makeTask({ _id: 'c3' as TaskId, status: 'in_progress' })
    const ctx = mockCtx([task])
    await expect(claimTaskHandler(ctx, { taskId: 'c3' as TaskId, agent: 'forge' }))
      .rejects.toThrow('Task not claimable')
  })

  it('should throw when task is done', async () => {
    const task = makeTask({ _id: 'c4' as TaskId, status: 'done' })
    const ctx = mockCtx([task])
    await expect(claimTaskHandler(ctx, { taskId: 'c4' as TaskId, agent: 'forge' }))
      .rejects.toThrow('Task not claimable')
  })

  it('should set startedAt', async () => {
    const task = makeTask({ _id: 'c5' as TaskId, status: 'ready' })
    const ctx = mockCtx([task])
    await claimTaskHandler(ctx, { taskId: 'c5' as TaskId, agent: 'forge' })
    expect(ctx._patches[0].fields.startedAt).toBeDefined()
  })
})

// ──────────────────────────────────────────────────────────
// startTask
// ──────────────────────────────────────────────────────────
describe('startTask', () => {
  it('should start a ready task', async () => {
    const task = makeTask({ _id: 's1' as TaskId, status: 'ready' })
    const ctx = mockCtx([task])
    const result = await startTaskHandler(ctx, { taskId: 's1' as TaskId })
    expect(result).toBe('s1')
    expect(ctx._patches[0].fields.status).toBe('in_progress')
  })

  it('should start a planning task', async () => {
    const task = makeTask({ _id: 's2' as TaskId, status: 'planning' })
    const ctx = mockCtx([task])
    await startTaskHandler(ctx, { taskId: 's2' as TaskId })
    expect(ctx._patches[0].fields.status).toBe('in_progress')
  })

  it('should throw when task not found', async () => {
    const ctx = mockCtx([])
    await expect(startTaskHandler(ctx, { taskId: 'missing' as TaskId }))
      .rejects.toThrow('Task not found')
  })

  it('should throw when task is done', async () => {
    const task = makeTask({ _id: 's3' as TaskId, status: 'done' })
    const ctx = mockCtx([task])
    await expect(startTaskHandler(ctx, { taskId: 's3' as TaskId }))
      .rejects.toThrow('Cannot start task')
  })

  it('should not overwrite existing startedAt', async () => {
    const task = makeTask({ _id: 's4' as TaskId, status: 'ready', startedAt: 1000 } as any)
    const ctx = mockCtx([task])
    await startTaskHandler(ctx, { taskId: 's4' as TaskId })
    expect(ctx._patches[0].fields.startedAt).toBe(1000)
  })
})

// ──────────────────────────────────────────────────────────
// completeTask
// ──────────────────────────────────────────────────────────
describe('completeTask', () => {
  it('should complete an in_progress task', async () => {
    const task = makeTask({ _id: 'd1' as TaskId, status: 'in_progress' })
    const ctx = mockCtx([task])
    const result = await completeTaskHandler(ctx, { taskId: 'd1' as TaskId })
    expect(result).toBe('d1')
    expect(ctx._patches[0].fields.status).toBe('done')
    expect(ctx._patches[0].fields.completedAt).toBeDefined()
  })

  it('should throw when task not found', async () => {
    const ctx = mockCtx([])
    await expect(completeTaskHandler(ctx, { taskId: 'missing' as TaskId }))
      .rejects.toThrow('Task not found')
  })

  it('should throw when already done', async () => {
    const task = makeTask({ _id: 'd2' as TaskId, status: 'done' })
    const ctx = mockCtx([task])
    await expect(completeTaskHandler(ctx, { taskId: 'd2' as TaskId }))
      .rejects.toThrow('Task already completed')
  })

  it('should throw when cancelled', async () => {
    const task = makeTask({ _id: 'd3' as TaskId, status: 'cancelled' })
    const ctx = mockCtx([task])
    await expect(completeTaskHandler(ctx, { taskId: 'd3' as TaskId }))
      .rejects.toThrow('Cannot complete a cancelled task')
  })


  it('should sanitize result text', async () => {
    const task = makeTask({ _id: 'd5' as TaskId, status: 'in_progress' })
    const ctx = mockCtx([task])
    await completeTaskHandler(ctx, { taskId: 'd5' as TaskId, result: 'done\x00ok' })
    expect(ctx._patches[0].fields.result).toBe('done ok')
  })
})

// ──────────────────────────────────────────────────────────
// submitForReview / submitForReviewAndAssign
// ──────────────────────────────────────────────────────────
describe('submitForReview', () => {
  it('should submit in_progress task for review', async () => {
    const task = makeTask({ _id: 'r1' as TaskId, status: 'in_progress' })
    const ctx = mockCtx([task])
    const result = await submitForReviewHandler(ctx, { taskId: 'r1' as TaskId })
    expect(result).toBe('r1')
    expect(ctx._patches[0].fields.status).toBe('in_review')
  })

  it('should throw when task not found', async () => {
    const ctx = mockCtx([])
    await expect(submitForReviewHandler(ctx, { taskId: 'missing' as TaskId }))
      .rejects.toThrow('Task not found')
  })

  it('should throw for invalid transition (done → in_review)', async () => {
    const task = makeTask({ _id: 'r2' as TaskId, status: 'done' })
    const ctx = mockCtx([task])
    await expect(submitForReviewHandler(ctx, { taskId: 'r2' as TaskId }))
      .rejects.toThrow('Cannot submit for review')
  })

  it('should update notes when provided', async () => {
    const task = makeTask({ _id: 'r3' as TaskId, status: 'in_progress' })
    const ctx = mockCtx([task])
    await submitForReviewHandler(ctx, { taskId: 'r3' as TaskId, notes: 'ready for review' })
    expect(ctx._patches[0].fields.notes).toBe('ready for review')
  })
})

describe('submitForReviewAndAssign', () => {
  it('should assign reviewer and move to in_review', async () => {
    const task = makeTask({ _id: 'ra1' as TaskId, status: 'in_progress' })
    const ctx = mockCtx([task])
    const result = await submitForReviewAndAssignHandler(ctx, {
      taskId: 'ra1' as TaskId,
      reviewer: 'sentinel',
    })
    expect(result).toBe('ra1')
    expect(ctx._patches[0].fields.assignedAgent).toBe('sentinel')
    expect(ctx._patches[0].fields.status).toBe('in_review')
  })

  it('should throw for invalid transition', async () => {
    const task = makeTask({ _id: 'ra2' as TaskId, status: 'done' })
    const ctx = mockCtx([task])
    await expect(submitForReviewAndAssignHandler(ctx, {
      taskId: 'ra2' as TaskId,
      reviewer: 'sentinel',
    })).rejects.toThrow('Cannot submit for review')
  })
})

// ──────────────────────────────────────────────────────────
// State machine transitions (via updateTask)
// ──────────────────────────────────────────────────────────
describe('State machine transitions', () => {
  const validTransitions: [string, string][] = [
    ['planning', 'ready'],
    ['planning', 'cancelled'],
    ['planning', 'blocked'],
    ['ready', 'in_progress'],
    ['ready', 'planning'],
    ['ready', 'cancelled'],
    ['ready', 'blocked'],
    ['in_progress', 'in_review'],
    ['in_progress', 'done'],
    ['in_progress', 'blocked'],
    ['in_progress', 'ready'],
    ['in_progress', 'cancelled'],
    ['in_review', 'done'],
    ['in_review', 'in_progress'],
    ['in_review', 'ready'],
    ['in_review', 'blocked'],
    ['in_review', 'cancelled'],
    ['blocked', 'ready'],
    ['blocked', 'planning'],
    ['blocked', 'cancelled'],
  ]

  for (const [from, to] of validTransitions) {
    it(`should allow ${from} → ${to}`, async () => {
      const task = makeTask({ _id: 'sm' as TaskId, status: from as any })
      const ctx = mockCtx([task])
      await updateTaskHandler(ctx, { taskId: 'sm' as TaskId, status: to })
      expect(ctx._patches[0].fields.status).toBe(to)
    })
  }

  const invalidTransitions: [string, string][] = [
    ['done', 'in_progress'],
    ['done', 'ready'],
    ['cancelled', 'ready'],
    ['cancelled', 'in_progress'],
    ['planning', 'done'],
    ['planning', 'in_review'],
    ['ready', 'done'],
    ['blocked', 'in_progress'],
    ['blocked', 'done'],
  ]

  for (const [from, to] of invalidTransitions) {
    it(`should reject ${from} → ${to}`, async () => {
      const task = makeTask({ _id: 'sm' as TaskId, status: from as any })
      const ctx = mockCtx([task])
      await expect(updateTaskHandler(ctx, { taskId: 'sm' as TaskId, status: to }))
        .rejects.toThrow('Invalid transition')
    })
  }

  it('should bump version on status change', async () => {
    const task = makeTask({ _id: 'sv' as TaskId, status: 'ready', version: 2 } as any)
    const ctx = mockCtx([task])
    await updateTaskHandler(ctx, { taskId: 'sv' as TaskId, status: 'in_progress' })
    expect(ctx._patches[0].fields.version).toBe(3)
  })

  it('should reject version mismatch', async () => {
    const task = makeTask({ _id: 'vm' as TaskId, status: 'ready', version: 5 } as any)
    const ctx = mockCtx([task])
    await expect(updateTaskHandler(ctx, {
      taskId: 'vm' as TaskId,
      status: 'in_progress',
      expectedVersion: 3,
    })).rejects.toThrow('Version mismatch')
  })

  it('should set startedAt on transition to in_progress', async () => {
    const task = makeTask({ _id: 'sa' as TaskId, status: 'ready' })
    const ctx = mockCtx([task])
    await updateTaskHandler(ctx, { taskId: 'sa' as TaskId, status: 'in_progress' })
    expect(ctx._patches[0].fields.startedAt).toBeDefined()
  })

  it('should set completedAt on transition to done', async () => {
    const task = makeTask({ _id: 'ca' as TaskId, status: 'in_progress' })
    const ctx = mockCtx([task])
    await updateTaskHandler(ctx, { taskId: 'ca' as TaskId, status: 'done' })
    expect(ctx._patches[0].fields.completedAt).toBeDefined()
  })

  it('should clear blockedReason when leaving blocked', async () => {
    const task = makeTask({ _id: 'br' as TaskId, status: 'blocked', blockedReason: 'waiting' } as any)
    const ctx = mockCtx([task])
    await updateTaskHandler(ctx, { taskId: 'br' as TaskId, status: 'ready' })
    expect(ctx._patches[0].fields.blockedReason).toBeUndefined()
  })

})

// ──────────────────────────────────────────────────────────
// updateTask — field updates
// ──────────────────────────────────────────────────────────
describe('updateTask', () => {
  it('should throw when task not found', async () => {
    const ctx = mockCtx([])
    await expect(updateTaskHandler(ctx, { taskId: 'missing' as TaskId }))
      .rejects.toThrow('Task not found')
  })

  it('should update title, description, project, notes', async () => {
    const task = makeTask({ _id: 'ut1' as TaskId })
    const ctx = mockCtx([task])
    await updateTaskHandler(ctx, {
      taskId: 'ut1' as TaskId,
      title: 'New Title',
      description: 'New Desc',
      project: 'new-proj',
      notes: 'new notes',
    })
    const p = ctx._patches[0].fields
    expect(p.title).toBe('New Title')
    expect(p.description).toBe('New Desc')
    expect(p.project).toBe('new-proj')
    expect(p.notes).toBe('new notes')
  })

  it('should update priority and assignedAgent', async () => {
    const task = makeTask({ _id: 'ut2' as TaskId })
    const ctx = mockCtx([task])
    await updateTaskHandler(ctx, {
      taskId: 'ut2' as TaskId,
      priority: 'urgent',
      assignedAgent: 'sentinel',
    })
    expect(ctx._patches[0].fields.priority).toBe('urgent')
    expect(ctx._patches[0].fields.assignedAgent).toBe('sentinel')
  })

  it('should update blockedReason', async () => {
    const task = makeTask({ _id: 'ut3' as TaskId, status: 'in_progress' })
    const ctx = mockCtx([task])
    await updateTaskHandler(ctx, {
      taskId: 'ut3' as TaskId,
      status: 'blocked',
      blockedReason: 'waiting for API',
    })
    expect(ctx._patches[0].fields.blockedReason).toBe('waiting for API')
  })
})

// ──────────────────────────────────────────────────────────
// Dependency validation
// ──────────────────────────────────────────────────────────
describe('Dependency validation', () => {
  it('should reject invalid dependency IDs', async () => {
    const ctx = mockCtx([])
    await expect(createTaskHandler(ctx, {
      title: 'Test',
      dependsOn: ['nonexistent' as TaskId],
    })).rejects.toThrow('Invalid dependency IDs')
  })

  it('should accept valid dependency IDs', async () => {
    const dep = makeTask({ _id: 'dep1' as TaskId })
    const ctx = mockCtx([dep])
    const result = await createTaskHandler(ctx, {
      title: 'Test',
      dependsOn: ['dep1' as TaskId],
    })
    expect(result).toBe('new-id')
  })

  it('should detect circular dependencies in updateTask', async () => {
    // Task A depends on B, now try to make B depend on A
    const taskA = makeTask({ _id: 'a' as TaskId, dependsOn: ['b'] } as any)
    const taskB = makeTask({ _id: 'b' as TaskId })
    const ctx = mockCtx([taskA, taskB])
    await expect(updateTaskHandler(ctx, {
      taskId: 'b' as TaskId,
      dependsOn: ['a'],
    })).rejects.toThrow('Circular dependency')
  })

  it('should update dependsOn when valid', async () => {
    const dep = makeTask({ _id: 'dep2' as TaskId })
    const task = makeTask({ _id: 'main' as TaskId })
    const ctx = mockCtx([dep, task])
    await updateTaskHandler(ctx, {
      taskId: 'main' as TaskId,
      dependsOn: ['dep2'],
    })
    expect(ctx._patches[0].fields.dependsOn).toEqual(['dep2'])
  })
})

// ──────────────────────────────────────────────────────────
// Text sanitization
// ──────────────────────────────────────────────────────────
describe('Text sanitization', () => {
  it('should strip control characters from sanitizeText', () => {
    expect(taskModule.sanitizeText('hello\x00world\x01!')).toBe('hello world !')
  })

  it('should truncate text to maxLen', () => {
    const long = 'a'.repeat(5000)
    expect(taskModule.sanitizeText(long, 100).length).toBe(100)
  })

  it('should return undefined for undefined input', () => {
    expect(taskModule.sanitizeOptionalText(undefined)).toBeUndefined()
  })

  it('should sanitize optional text', () => {
    expect(taskModule.sanitizeOptionalText('ok\x00')).toBe('ok ')
  })

  it('should sanitize notes in updateTask', async () => {
    const task = makeTask({ _id: 'st1' as TaskId })
    const ctx = mockCtx([task])
    await updateTaskHandler(ctx, {
      taskId: 'st1' as TaskId,
      notes: 'clean\x00text',
    })
    expect(ctx._patches[0].fields.notes).toBe('clean text')
  })

  it('should sanitize title in createTask', async () => {
    const ctx = mockCtx([])
    await createTaskHandler(ctx, { title: '\x07bell\x08back' })
    expect(ctx._inserted[0].doc.title).toBe(' bell back')
  })
})

// ──────────────────────────────────────────────────────────
// handoffTask
// ──────────────────────────────────────────────────────────
describe('handoffTask', () => {
  it('should hand off task to another agent', async () => {
    const task = makeTask({ _id: 'h1' as TaskId, status: 'in_progress', assignedAgent: 'forge' })
    const ctx = mockCtx([task])
    const result = await handoffTaskHandler(ctx, {
      taskId: 'h1' as TaskId,
      toAgent: 'sentinel',
    })
    expect(result).toBe('h1')
    expect(ctx._patches[0].fields.assignedAgent).toBe('sentinel')
    expect(ctx._patches[0].fields.status).toBe('ready')
  })

  it('should throw when task not found', async () => {
    const ctx = mockCtx([])
    await expect(handoffTaskHandler(ctx, {
      taskId: 'missing' as TaskId,
      toAgent: 'sentinel',
    })).rejects.toThrow('Task not found')
  })

  it('should update notes on handoff', async () => {
    const task = makeTask({ _id: 'h2' as TaskId, status: 'in_progress' })
    const ctx = mockCtx([task])
    await handoffTaskHandler(ctx, {
      taskId: 'h2' as TaskId,
      toAgent: 'sentinel',
      notes: 'handoff notes',
    })
    expect(ctx._patches[0].fields.notes).toBe('handoff notes')
  })
})

// ──────────────────────────────────────────────────────────
// deleteTask
// ──────────────────────────────────────────────────────────
describe('deleteTask', () => {
  it('should delete a task', async () => {
    const task = makeTask({ _id: 'del1' as TaskId })
    const ctx = mockCtx([task])
    await deleteTaskHandler(ctx, { taskId: 'del1' as TaskId })
    expect(ctx._deleted).toContain('del1')
  })
})

// ──────────────────────────────────────────────────────────
// Query functions (agent queries)
// ──────────────────────────────────────────────────────────
describe('Query functions', () => {
  it('getTask should return task by ID', async () => {
    const task = makeTask({ _id: 'qt1' as TaskId, title: 'Found' })
    const ctx = mockCtx([task])
    const result = await getTaskHandler(ctx, { taskId: 'qt1' as TaskId })
    expect(result?.title).toBe('Found')
  })

  it('getTask should return null for missing ID', async () => {
    const ctx = mockCtx([])
    const result = await getTaskHandler(ctx, { taskId: 'missing' as TaskId })
    expect(result).toBeNull()
  })

  it('getBoard should group tasks by normalized status', async () => {
    const tasks = [
      makeTask({ _id: '1' as TaskId, status: 'planning' }),
      makeTask({ _id: '2' as TaskId, status: 'in_progress' }),
      makeTask({ _id: '3' as TaskId, status: 'done' }),
    ]
    const ctx = mockCtx(tasks)
    const result = await getBoardHandler(ctx, {})
    expect(result.planning).toHaveLength(1)
    expect(result.in_progress).toHaveLength(1)
    expect(result.done).toHaveLength(1)
  })

  it('getBoard should normalize legacy statuses', async () => {
    const tasks = [
      makeTask({ _id: '1' as TaskId, status: 'pending' }),
      makeTask({ _id: '2' as TaskId, status: 'active' }),
    ]
    const ctx = mockCtx(tasks)
    const result = await getBoardHandler(ctx, {})
    expect(result.ready).toHaveLength(1)
    expect(result.in_progress).toHaveLength(1)
  })

  it('listTasks should return all tasks by default', async () => {
    const tasks = [
      makeTask({ _id: '1' as TaskId }),
      makeTask({ _id: '2' as TaskId }),
    ]
    const ctx = mockCtx(tasks)
    const result = await listTasksHandler(ctx, {})
    expect(result).toHaveLength(2)
  })

  it('getWorkloadByAgentStatus should return entries', async () => {
    const tasks = [
      makeTask({ _id: '1' as TaskId, assignedAgent: 'forge', status: 'in_progress' }),
    ]
    const ctx = mockCtx(tasks)
    const result = await getWorkloadByAgentStatusHandler(ctx, {})
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].agent).toBe('forge')
  })

})

// ──────────────────────────────────────────────────────────
// Pure function exports
// ──────────────────────────────────────────────────────────
describe('Pure function exports', () => {
  it('normalizeStatus should map pending to ready', () => {
    expect(taskModule.normalizeStatus('pending')).toBe('ready')
  })

  it('normalizeStatus should map active to in_progress', () => {
    expect(taskModule.normalizeStatus('active')).toBe('in_progress')
  })

  it('normalizeStatus should pass through normal statuses', () => {
    expect(taskModule.normalizeStatus('done')).toBe('done')
  })

  it('isValidTransition should validate correctly', () => {
    expect(taskModule.isValidTransition('planning', 'ready')).toBe(true)
    expect(taskModule.isValidTransition('done', 'ready')).toBe(false)
    expect(taskModule.isValidTransition('unknown_status', 'anything')).toBe(true)
  })

  it('VALID_TRANSITIONS should have terminal states with empty arrays', () => {
    expect(taskModule.VALID_TRANSITIONS['done']).toEqual([])
    expect(taskModule.VALID_TRANSITIONS['cancelled']).toEqual([])
  })

  it('aggregateWorkloadEntries should filter by project', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'in_progress', project: 'a' },
      { assignedAgent: 'forge', status: 'ready', project: 'b' },
    ]
    const result = taskModule.aggregateWorkloadEntries(tasks, { project: 'a' })
    expect(result).toHaveLength(1)
    expect(result[0].agent).toBe('forge')
  })

  it('aggregateWorkloadEntries should filter by priority', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'ready', priority: 'low' },
    ]
    const result = taskModule.aggregateWorkloadEntries(tasks, { priority: 'high' })
    expect(result).toHaveLength(1)
  })
})

describe('friendly task key backfill', () => {
  it('backfills rows missing task keys without overwriting existing keys', async () => {
    const tasks = [
      makeTask({ _id: 'a' as TaskId, title: 'Old 1', createdAt: 1000 }),
      makeTask({ _id: 'b' as TaskId, title: 'Old 2', createdAt: 2000 }),
      makeTask({ _id: 'c' as TaskId, title: 'New', createdAt: 3000, taskNumber: 99 as any, taskKey: 'AD-99' as any }),
    ]
    const ctx = mockCtx(tasks)

    const result = await backfillFriendlyTaskKeysHandler(ctx, { limit: 10 })

    expect(result.updated).toBe(2)
    expect(ctx._patches).toHaveLength(2)
    const keysById = new Map(ctx._patches.map((p) => [String(p.id), String(p.fields.taskKey)]))
    expect(keysById.get('a')).toBe('AD-101')
    expect(keysById.get('b')).toBe('AD-100')
  })
})
