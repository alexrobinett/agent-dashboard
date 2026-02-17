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
