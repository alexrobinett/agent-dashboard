import { describe, it, expect, vi } from 'vitest'
import type { Doc, Id } from '../_generated/dataModel'

// ──────────────────────────────────────────────────────────
// Mock convex server so we can import tasks.ts and extract handlers
// ──────────────────────────────────────────────────────────
vi.mock('../_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
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

function mockCtx(tasks: Task[]) {
  return {
    db: {
      query: (_table: string) => ({
        order: (_dir: string) => ({
          take: async (n: number) => tasks.slice(0, n),
        }),
      }),
      get: async (id: TaskId) => tasks.find(t => t._id === id) ?? null,
      insert: async (_table: string, _doc: Record<string, unknown>) => 'new-id' as TaskId,
      patch: async (_id: TaskId, _fields: Record<string, unknown>) => {},
      delete: async (_id: TaskId) => {},
    },
  }
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
      leaseOwner: 'forge-123',
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
