/**
 * Sprint 4: Filter/Search Behavior Tests
 *
 * Tests exercise the actual listFiltered query handler from convex/tasks.ts,
 * verifying that filtering by status, priority, project, and assignedAgent
 * produces correct results against real task data arrays, and that pagination
 * slices results correctly.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../convex/_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
}))

import * as taskModule from '../../../convex/tasks'

type HandlerExtractor = { handler: (...args: any[]) => Promise<any> }
const listFilteredHandler = (taskModule.listFiltered as unknown as HandlerExtractor).handler

// Mock Convex query context backed by a real task array
function mockCtx(tasks: any[]) {
  return {
    db: {
      query: (_table: string) => ({
        order: (_dir: string) => ({
          take: async (n: number) => tasks.slice(0, n),
        }),
      }),
    },
  }
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    _id: `j57${Math.random().toString(36).slice(2, 10)}`,
    _creationTime: Date.now(),
    title: 'Test Task',
    status: 'planning',
    priority: 'normal',
    assignedAgent: 'unassigned',
    project: 'agent-dashboard',
    createdBy: 'test',
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('Filter/Search - listFiltered query handler', () => {
  // A realistic heterogeneous dataset
  const sampleTasks = [
    makeTask({ title: 'Plan API design', status: 'planning', priority: 'high', assignedAgent: 'forge', project: 'agent-dashboard' }),
    makeTask({ title: 'Plan database schema', status: 'planning', priority: 'normal', assignedAgent: 'sentinel', project: 'options-trader' }),
    makeTask({ title: 'Implement auth flow', status: 'in_progress', priority: 'urgent', assignedAgent: 'forge', project: 'agent-dashboard' }),
    makeTask({ title: 'Review PR #42', status: 'in_review', priority: 'high', assignedAgent: 'oracle', project: 'options-trader' }),
    makeTask({ title: 'Deploy to staging', status: 'done', priority: 'low', assignedAgent: 'sentinel', project: 'agent-dashboard' }),
    makeTask({ title: 'Fix broken pipeline', status: 'blocked', priority: 'normal', assignedAgent: 'friday', project: 'options-trader' }),
    makeTask({ title: 'Write unit tests', status: 'ready', priority: 'normal', assignedAgent: 'forge', project: 'agent-dashboard' }),
    makeTask({ title: 'Update docs', status: 'ready', priority: 'low', assignedAgent: 'oracle', project: 'options-trader' }),
  ]

  it('should return all tasks when no filters are applied', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, {})

    expect(result.tasks).toHaveLength(8)
    expect(result.total).toBe(8)
    expect(result.hasMore).toBe(false)
  })

  it('should filter by status=ready and return only ready tasks', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { status: 'ready' })

    expect(result.tasks).toHaveLength(2)
    expect(result.total).toBe(2)
    // Verify every returned task actually has the correct status
    for (const task of result.tasks) {
      expect(task.status).toBe('ready')
    }
    // Verify the specific titles that should match
    const titles = result.tasks.map((t: any) => t.title).sort()
    expect(titles).toEqual(['Update docs', 'Write unit tests'])
  })

  it('should filter by status=planning and return exactly matching tasks', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { status: 'planning' })

    expect(result.tasks).toHaveLength(2)
    const titles = result.tasks.map((t: any) => t.title).sort()
    expect(titles).toEqual(['Plan API design', 'Plan database schema'])
  })

  it('should filter by priority=high and return correct tasks', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { priority: 'high' })

    expect(result.tasks).toHaveLength(2)
    expect(result.tasks.every((t: any) => t.priority === 'high')).toBe(true)
    const titles = result.tasks.map((t: any) => t.title).sort()
    expect(titles).toEqual(['Plan API design', 'Review PR #42'])
  })

  it('should filter by assignedAgent=forge and return only forge tasks', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { assignedAgent: 'forge' })

    expect(result.tasks).toHaveLength(3)
    expect(result.tasks.every((t: any) => t.assignedAgent === 'forge')).toBe(true)
    const titles = result.tasks.map((t: any) => t.title).sort()
    expect(titles).toEqual(['Implement auth flow', 'Plan API design', 'Write unit tests'])
  })

  it('should filter by project and return only matching project tasks', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { project: 'options-trader' })

    expect(result.tasks).toHaveLength(4)
    expect(result.tasks.every((t: any) => t.project === 'options-trader')).toBe(true)
  })

  it('should combine status + priority filters to narrow results', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { status: 'planning', priority: 'high' })

    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].title).toBe('Plan API design')
    expect(result.tasks[0].status).toBe('planning')
    expect(result.tasks[0].priority).toBe('high')
  })

  it('should combine agent + project filters correctly', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, {
      assignedAgent: 'sentinel',
      project: 'agent-dashboard',
    })

    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].title).toBe('Deploy to staging')
    expect(result.tasks[0].assignedAgent).toBe('sentinel')
    expect(result.tasks[0].project).toBe('agent-dashboard')
  })

  it('should combine all four filters together', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, {
      status: 'in_progress',
      priority: 'urgent',
      assignedAgent: 'forge',
      project: 'agent-dashboard',
    })

    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].title).toBe('Implement auth flow')
  })

  it('should return empty results when no tasks match filters', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { status: 'cancelled' })

    expect(result.tasks).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
  })

  it('should return empty when filter combination excludes all tasks', async () => {
    const ctx = mockCtx(sampleTasks)
    // forge has no blocked tasks
    const result = await listFilteredHandler(ctx, {
      assignedAgent: 'forge',
      status: 'blocked',
    })

    expect(result.tasks).toHaveLength(0)
    expect(result.total).toBe(0)
  })

  it('should apply pagination with limit', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { limit: 3 })

    expect(result.tasks).toHaveLength(3)
    expect(result.total).toBe(8)
    expect(result.limit).toBe(3)
    expect(result.offset).toBe(0)
    expect(result.hasMore).toBe(true)
  })

  it('should paginate across pages without overlap or gaps', async () => {
    const ctx = mockCtx(sampleTasks)
    const page1 = await listFilteredHandler(ctx, { limit: 3, offset: 0 })
    const page2 = await listFilteredHandler(ctx, { limit: 3, offset: 3 })
    const page3 = await listFilteredHandler(ctx, { limit: 3, offset: 6 })

    expect(page1.tasks).toHaveLength(3)
    expect(page1.hasMore).toBe(true)
    expect(page2.tasks).toHaveLength(3)
    expect(page2.hasMore).toBe(true)
    expect(page3.tasks).toHaveLength(2) // only 2 remaining
    expect(page3.hasMore).toBe(false)

    // All pages together should cover all 8 tasks with no overlap
    const allIds = [
      ...page1.tasks.map((t: any) => t._id),
      ...page2.tasks.map((t: any) => t._id),
      ...page3.tasks.map((t: any) => t._id),
    ]
    expect(new Set(allIds).size).toBe(8)
  })

  it('should paginate filtered results correctly', async () => {
    // 5 ready tasks + 3 non-ready tasks
    const readyTasks = Array.from({ length: 5 }, (_, i) =>
      makeTask({ title: `Ready Task ${i}`, status: 'ready' })
    )
    const mixed = [...readyTasks, makeTask({ status: 'done' }), makeTask({ status: 'planning' }), makeTask({ status: 'blocked' })]
    const ctx = mockCtx(mixed)

    const page1 = await listFilteredHandler(ctx, { status: 'ready', limit: 2, offset: 0 })
    const page2 = await listFilteredHandler(ctx, { status: 'ready', limit: 2, offset: 2 })
    const page3 = await listFilteredHandler(ctx, { status: 'ready', limit: 2, offset: 4 })

    expect(page1.tasks).toHaveLength(2)
    expect(page1.total).toBe(5)
    expect(page1.hasMore).toBe(true)
    expect(page1.tasks.every((t: any) => t.status === 'ready')).toBe(true)

    expect(page2.tasks).toHaveLength(2)
    expect(page2.hasMore).toBe(true)

    expect(page3.tasks).toHaveLength(1) // only 1 remaining
    expect(page3.hasMore).toBe(false)
  })

  it('should use default limit of 50 and offset of 0', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, {})

    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it('should handle empty database', async () => {
    const ctx = mockCtx([])
    const result = await listFilteredHandler(ctx, {})

    expect(result.tasks).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
  })

  it('should preserve full task data shape in filtered results', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { status: 'in_progress' })

    expect(result.tasks).toHaveLength(1)
    const task = result.tasks[0]
    // Verify the full task object is returned, not a partial projection
    expect(task._id).toBeDefined()
    expect(task.title).toBe('Implement auth flow')
    expect(task.status).toBe('in_progress')
    expect(task.priority).toBe('urgent')
    expect(task.assignedAgent).toBe('forge')
    expect(task.project).toBe('agent-dashboard')
    expect(task.createdBy).toBe('test')
    expect(task.createdAt).toBeTypeOf('number')
  })

  it('should handle single-status dataset correctly', async () => {
    const allPlanning = Array.from({ length: 4 }, (_, i) =>
      makeTask({ title: `Planning ${i}`, status: 'planning' })
    )
    const ctx = mockCtx(allPlanning)

    const planning = await listFilteredHandler(ctx, { status: 'planning' })
    expect(planning.tasks).toHaveLength(4)

    const done = await listFilteredHandler(ctx, { status: 'done' })
    expect(done.tasks).toHaveLength(0)
  })
})
