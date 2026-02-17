import { describe, it, expect, vi } from 'vitest'
import type { Doc, Id } from '../_generated/dataModel'

// ──────────────────────────────────────────────────────────
// Mock convex server so we can import tasks.ts and extract handlers
// ──────────────────────────────────────────────────────────
vi.mock('../_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
}))

// Import AFTER mocking
import * as taskModule from '../tasks'
import { aggregateWorkloadEntries, type WorkloadEntry } from '../tasks'

// Type helpers
type Task = Doc<'tasks'>
type TaskId = Id<'tasks'>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerExtractor = { handler: (...args: any[]) => Promise<any> }
const getWorkloadByAgentStatusHandler = (
  taskModule.getWorkloadByAgentStatus as unknown as HandlerExtractor
).handler

// ──────────────────────────────────────────────────────────
// Helpers
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
    },
  }
}

// ──────────────────────────────────────────────────────────
// aggregateWorkloadEntries — pure function tests
// ──────────────────────────────────────────────────────────
describe('aggregateWorkloadEntries (pure function)', () => {
  it('should return correct counts per agent per status', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'normal' },
      { assignedAgent: 'forge', status: 'done', priority: 'high' },
      { assignedAgent: 'sentinel', status: 'ready', priority: 'low' },
      { assignedAgent: 'sentinel', status: 'ready', priority: 'normal' },
    ]
    const result = aggregateWorkloadEntries(tasks)

    expect(result).toContainEqual({ agent: 'forge', status: 'in_progress', count: 2 })
    expect(result).toContainEqual({ agent: 'forge', status: 'done', count: 1 })
    expect(result).toContainEqual({ agent: 'sentinel', status: 'ready', count: 2 })
    expect(result).toHaveLength(3)
  })

  it('should handle multiple agents and statuses', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'in_progress' },
      { assignedAgent: 'forge', status: 'done' },
      { assignedAgent: 'sentinel', status: 'in_progress' },
      { assignedAgent: 'sentinel', status: 'done' },
      { assignedAgent: 'oracle', status: 'planning' },
    ]
    const result = aggregateWorkloadEntries(tasks)

    expect(result).toHaveLength(5)
    expect(result).toContainEqual({ agent: 'forge', status: 'in_progress', count: 1 })
    expect(result).toContainEqual({ agent: 'forge', status: 'done', count: 1 })
    expect(result).toContainEqual({ agent: 'sentinel', status: 'in_progress', count: 1 })
    expect(result).toContainEqual({ agent: 'sentinel', status: 'done', count: 1 })
    expect(result).toContainEqual({ agent: 'oracle', status: 'planning', count: 1 })
  })

  it('should return empty array for empty dataset', () => {
    const result = aggregateWorkloadEntries([])
    expect(result).toEqual([])
  })

  it('should use "unassigned" for tasks without an agent', () => {
    const tasks = [
      { status: 'planning', priority: 'normal' },
      { status: 'ready', priority: 'high' },
    ]
    const result = aggregateWorkloadEntries(tasks)

    expect(result).toContainEqual({ agent: 'unassigned', status: 'planning', count: 1 })
    expect(result).toContainEqual({ agent: 'unassigned', status: 'ready', count: 1 })
  })

  it('should default missing status to "planning"', () => {
    const tasks = [{ assignedAgent: 'forge' }]
    const result = aggregateWorkloadEntries(tasks)

    expect(result).toContainEqual({ agent: 'forge', status: 'planning', count: 1 })
  })

  it('should filter by project', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'in_progress', project: 'dash' },
      { assignedAgent: 'forge', status: 'done', project: 'dash' },
      { assignedAgent: 'forge', status: 'in_progress', project: 'other' },
      { assignedAgent: 'sentinel', status: 'ready', project: 'dash' },
    ]
    const result = aggregateWorkloadEntries(tasks, { project: 'dash' })

    expect(result).toHaveLength(3)
    expect(result).toContainEqual({ agent: 'forge', status: 'in_progress', count: 1 })
    expect(result).toContainEqual({ agent: 'forge', status: 'done', count: 1 })
    expect(result).toContainEqual({ agent: 'sentinel', status: 'ready', count: 1 })
  })

  it('should filter by priority', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'low' },
      { assignedAgent: 'sentinel', status: 'done', priority: 'high' },
    ]
    const result = aggregateWorkloadEntries(tasks, { priority: 'high' })

    expect(result).toHaveLength(2)
    expect(result).toContainEqual({ agent: 'forge', status: 'in_progress', count: 1 })
    expect(result).toContainEqual({ agent: 'sentinel', status: 'done', count: 1 })
  })

  it('should filter by both project and priority', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high', project: 'dash' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'low', project: 'dash' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high', project: 'other' },
      { assignedAgent: 'sentinel', status: 'done', priority: 'high', project: 'dash' },
    ]
    const result = aggregateWorkloadEntries(tasks, { project: 'dash', priority: 'high' })

    expect(result).toHaveLength(2)
    expect(result).toContainEqual({ agent: 'forge', status: 'in_progress', count: 1 })
    expect(result).toContainEqual({ agent: 'sentinel', status: 'done', count: 1 })
  })

  it('should match WorkloadEntry contract structure', () => {
    const tasks = [{ assignedAgent: 'forge', status: 'ready', priority: 'normal' }]
    const result = aggregateWorkloadEntries(tasks)

    expect(result).toHaveLength(1)
    const entry: WorkloadEntry = result[0]
    expect(entry).toHaveProperty('agent')
    expect(entry).toHaveProperty('status')
    expect(entry).toHaveProperty('count')
    expect(typeof entry.agent).toBe('string')
    expect(typeof entry.status).toBe('string')
    expect(typeof entry.count).toBe('number')
    expect(Object.keys(entry)).toHaveLength(3)
  })

  it('should aggregate within 50ms for 1000 tasks', () => {
    const agents = ['forge', 'sentinel', 'oracle', 'atlas', 'nexus']
    const statuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked']
    const priorities = ['low', 'normal', 'high', 'urgent']

    const tasks = Array.from({ length: 1000 }, (_, i) => ({
      assignedAgent: agents[i % agents.length],
      status: statuses[i % statuses.length],
      priority: priorities[i % priorities.length],
      project: `project-${i % 10}`,
    }))

    const start = performance.now()
    const result = aggregateWorkloadEntries(tasks)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(50)
    expect(result.length).toBeGreaterThan(0)
    // 5 agents × 6 statuses = 30 possible combinations
    expect(result.length).toBeLessThanOrEqual(30)

    // Verify total count sums to 1000
    const totalCount = result.reduce((sum, entry) => sum + entry.count, 0)
    expect(totalCount).toBe(1000)
  })
})

// ──────────────────────────────────────────────────────────
// getWorkloadByAgentStatus — query handler tests
// ──────────────────────────────────────────────────────────
describe('getWorkloadByAgentStatus query handler', () => {
  it('should return WorkloadEntry[] from the handler', async () => {
    const tasks = [
      makeTask({ _id: '1' as TaskId, assignedAgent: 'forge', status: 'in_progress', priority: 'high' }),
      makeTask({ _id: '2' as TaskId, assignedAgent: 'forge', status: 'done', priority: 'normal' }),
      makeTask({ _id: '3' as TaskId, assignedAgent: 'sentinel', status: 'in_progress', priority: 'low' }),
    ]
    const ctx = mockCtx(tasks)
    const result = await getWorkloadByAgentStatusHandler(ctx, {})

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(3)
    expect(result).toContainEqual({ agent: 'forge', status: 'in_progress', count: 1 })
    expect(result).toContainEqual({ agent: 'forge', status: 'done', count: 1 })
    expect(result).toContainEqual({ agent: 'sentinel', status: 'in_progress', count: 1 })
  })

  it('should return empty array when no tasks exist', async () => {
    const ctx = mockCtx([])
    const result = await getWorkloadByAgentStatusHandler(ctx, {})

    expect(result).toEqual([])
  })

  it('should filter by project when provided', async () => {
    const tasks = [
      makeTask({ _id: '1' as TaskId, assignedAgent: 'forge', status: 'in_progress', project: 'dash' }),
      makeTask({ _id: '2' as TaskId, assignedAgent: 'forge', status: 'done', project: 'other' }),
      makeTask({ _id: '3' as TaskId, assignedAgent: 'sentinel', status: 'ready', project: 'dash' }),
    ]
    const ctx = mockCtx(tasks)
    const result = await getWorkloadByAgentStatusHandler(ctx, { project: 'dash' })

    expect(result).toHaveLength(2)
    expect(result).toContainEqual({ agent: 'forge', status: 'in_progress', count: 1 })
    expect(result).toContainEqual({ agent: 'sentinel', status: 'ready', count: 1 })
  })

  it('should filter by priority when provided', async () => {
    const tasks = [
      makeTask({ _id: '1' as TaskId, assignedAgent: 'forge', status: 'in_progress', priority: 'high' }),
      makeTask({ _id: '2' as TaskId, assignedAgent: 'forge', status: 'in_progress', priority: 'low' }),
      makeTask({ _id: '3' as TaskId, assignedAgent: 'sentinel', status: 'done', priority: 'high' }),
    ]
    const ctx = mockCtx(tasks)
    const result = await getWorkloadByAgentStatusHandler(ctx, { priority: 'high' })

    expect(result).toHaveLength(2)
    expect(result).toContainEqual({ agent: 'forge', status: 'in_progress', count: 1 })
    expect(result).toContainEqual({ agent: 'sentinel', status: 'done', count: 1 })
  })

  it('should support combined project and priority filters', async () => {
    const tasks = [
      makeTask({ _id: '1' as TaskId, assignedAgent: 'forge', status: 'in_progress', priority: 'high', project: 'dash' }),
      makeTask({ _id: '2' as TaskId, assignedAgent: 'forge', status: 'in_progress', priority: 'low', project: 'dash' }),
      makeTask({ _id: '3' as TaskId, assignedAgent: 'forge', status: 'in_progress', priority: 'high', project: 'other' }),
    ]
    const ctx = mockCtx(tasks)
    const result = await getWorkloadByAgentStatusHandler(ctx, { project: 'dash', priority: 'high' })

    expect(result).toHaveLength(1)
    expect(result).toContainEqual({ agent: 'forge', status: 'in_progress', count: 1 })
  })

  it('should handle unassigned agents', async () => {
    const tasks = [
      makeTask({ _id: '1' as TaskId, status: 'planning' }),
    ]
    const ctx = mockCtx(tasks)
    const result = await getWorkloadByAgentStatusHandler(ctx, {})

    expect(result).toContainEqual({ agent: 'unassigned', status: 'planning', count: 1 })
  })
})
