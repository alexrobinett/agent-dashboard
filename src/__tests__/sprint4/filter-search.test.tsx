/**
 * Sprint 4: Filter/Search Behavior Tests
 *
 * Tests exercise the actual listFiltered query handler from convex/tasks.ts,
 * verifying that filtering by status, priority, project, and assignedAgent
 * produces correct results, and that pagination works correctly.
 */

import { describe, it, expect } from 'vitest'
import * as taskModule from '../../../convex/tasks'

type HandlerExtractor = { handler: (...args: any[]) => Promise<any> }
const listFilteredHandler = (taskModule.listFiltered as unknown as HandlerExtractor).handler

// Mock Convex query context
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
  const sampleTasks = [
    makeTask({ title: 'Plan A', status: 'planning', priority: 'high', assignedAgent: 'forge', project: 'agent-dashboard' }),
    makeTask({ title: 'Plan B', status: 'planning', priority: 'normal', assignedAgent: 'sentinel', project: 'options-trader' }),
    makeTask({ title: 'Active C', status: 'in_progress', priority: 'urgent', assignedAgent: 'forge', project: 'agent-dashboard' }),
    makeTask({ title: 'Review D', status: 'in_review', priority: 'high', assignedAgent: 'oracle', project: 'options-trader' }),
    makeTask({ title: 'Done E', status: 'done', priority: 'low', assignedAgent: 'sentinel', project: 'agent-dashboard' }),
    makeTask({ title: 'Blocked F', status: 'blocked', priority: 'normal', assignedAgent: 'friday', project: 'options-trader' }),
  ]

  it('should return all tasks when no filters are applied', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, {})

    expect(result.tasks).toHaveLength(6)
    expect(result.total).toBe(6)
    expect(result.hasMore).toBe(false)
  })

  it('should filter tasks by status', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { status: 'planning' })

    expect(result.tasks).toHaveLength(2)
    expect(result.total).toBe(2)
    expect(result.tasks.every((t: any) => t.status === 'planning')).toBe(true)
  })

  it('should filter tasks by priority', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { priority: 'high' })

    expect(result.tasks).toHaveLength(2)
    expect(result.tasks.every((t: any) => t.priority === 'high')).toBe(true)
    // Verify the specific tasks matched
    const titles = result.tasks.map((t: any) => t.title).sort()
    expect(titles).toEqual(['Plan A', 'Review D'])
  })

  it('should filter tasks by assignedAgent', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { assignedAgent: 'forge' })

    expect(result.tasks).toHaveLength(2)
    expect(result.tasks.every((t: any) => t.assignedAgent === 'forge')).toBe(true)
  })

  it('should filter tasks by project', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { project: 'options-trader' })

    expect(result.tasks).toHaveLength(3)
    expect(result.tasks.every((t: any) => t.project === 'options-trader')).toBe(true)
  })

  it('should combine multiple filters (status + priority)', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { status: 'planning', priority: 'high' })

    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].title).toBe('Plan A')
    expect(result.tasks[0].status).toBe('planning')
    expect(result.tasks[0].priority).toBe('high')
  })

  it('should combine multiple filters (agent + project)', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, {
      assignedAgent: 'sentinel',
      project: 'agent-dashboard',
    })

    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0].title).toBe('Done E')
  })

  it('should return empty results when no tasks match filters', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { status: 'cancelled' })

    expect(result.tasks).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
  })

  it('should apply pagination with limit', async () => {
    const ctx = mockCtx(sampleTasks)
    const result = await listFilteredHandler(ctx, { limit: 2 })

    expect(result.tasks).toHaveLength(2)
    expect(result.total).toBe(6)
    expect(result.limit).toBe(2)
    expect(result.offset).toBe(0)
    expect(result.hasMore).toBe(true)
  })

  it('should apply pagination with offset', async () => {
    const ctx = mockCtx(sampleTasks)
    const page1 = await listFilteredHandler(ctx, { limit: 3, offset: 0 })
    const page2 = await listFilteredHandler(ctx, { limit: 3, offset: 3 })

    expect(page1.tasks).toHaveLength(3)
    expect(page2.tasks).toHaveLength(3)
    expect(page1.hasMore).toBe(true)
    expect(page2.hasMore).toBe(false)

    // Pages should not overlap
    const page1Ids = page1.tasks.map((t: any) => t._id)
    const page2Ids = page2.tasks.map((t: any) => t._id)
    const overlap = page1Ids.filter((id: string) => page2Ids.includes(id))
    expect(overlap).toHaveLength(0)
  })

  it('should paginate filtered results correctly', async () => {
    // Create 5 planning tasks to test pagination on filtered subset
    const planningTasks = Array.from({ length: 5 }, (_, i) =>
      makeTask({ title: `Plan ${i}`, status: 'planning' })
    )
    const mixed = [...planningTasks, makeTask({ status: 'done' })]
    const ctx = mockCtx(mixed)

    const result = await listFilteredHandler(ctx, { status: 'planning', limit: 2, offset: 0 })

    expect(result.tasks).toHaveLength(2)
    expect(result.total).toBe(5)
    expect(result.hasMore).toBe(true)
    expect(result.tasks.every((t: any) => t.status === 'planning')).toBe(true)
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
})
