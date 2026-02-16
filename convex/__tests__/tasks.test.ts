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
const getByStatusHandler = (taskModule.getByStatus as unknown as HandlerExtractor).handler
const getByIdHandler = (taskModule.getById as unknown as HandlerExtractor).handler
const listFilteredHandler = (taskModule.listFiltered as unknown as HandlerExtractor).handler

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
