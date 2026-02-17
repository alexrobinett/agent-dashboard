/**
 * Sprint 4: Workload View Behavior Tests
 *
 * Tests exercise the actual aggregateWorkload() pure function exported
 * from convex/tasks.ts and the getWorkload query handler, verifying
 * that task counts per agent are computed correctly from real data.
 */

import { describe, it, expect } from 'vitest'
import { aggregateWorkload } from '../../../convex/tasks'
import * as taskModule from '../../../convex/tasks'

type HandlerExtractor = { handler: (...args: any[]) => Promise<any> }
const getWorkloadHandler = (taskModule.getWorkload as unknown as HandlerExtractor).handler

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

describe('Workload View - aggregateWorkload() pure function', () => {
  it('should count total tasks per agent', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'planning', priority: 'normal' },
      { assignedAgent: 'forge', status: 'done', priority: 'low' },
      { assignedAgent: 'sentinel', status: 'in_review', priority: 'high' },
    ]
    const result = aggregateWorkload(tasks)

    expect(result['forge'].total).toBe(3)
    expect(result['sentinel'].total).toBe(1)
  })

  it('should break down tasks by status per agent', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'in_progress', priority: 'normal' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'planning', priority: 'normal' },
      { assignedAgent: 'sentinel', status: 'done', priority: 'normal' },
      { assignedAgent: 'sentinel', status: 'in_progress', priority: 'high' },
    ]
    const result = aggregateWorkload(tasks)

    expect(result['forge'].byStatus['in_progress']).toBe(2)
    expect(result['forge'].byStatus['planning']).toBe(1)
    expect(result['forge'].byStatus['done']).toBeUndefined()
    expect(result['sentinel'].byStatus['done']).toBe(1)
    expect(result['sentinel'].byStatus['in_progress']).toBe(1)
  })

  it('should break down tasks by priority per agent', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'planning', priority: 'urgent' },
      { assignedAgent: 'forge', status: 'planning', priority: 'high' },
      { assignedAgent: 'forge', status: 'planning', priority: 'high' },
      { assignedAgent: 'forge', status: 'planning', priority: 'normal' },
      { assignedAgent: 'oracle', status: 'planning', priority: 'low' },
    ]
    const result = aggregateWorkload(tasks)

    expect(result['forge'].byPriority['urgent']).toBe(1)
    expect(result['forge'].byPriority['high']).toBe(2)
    expect(result['forge'].byPriority['normal']).toBe(1)
    expect(result['forge'].byPriority['low']).toBeUndefined()
    expect(result['oracle'].byPriority['low']).toBe(1)
  })

  it('should assign tasks without agent to "unassigned"', () => {
    const tasks = [
      { status: 'planning', priority: 'normal' },
      { assignedAgent: undefined, status: 'ready', priority: 'high' },
      { assignedAgent: '', status: 'blocked', priority: 'low' },
      { assignedAgent: 'forge', status: 'done', priority: 'normal' },
    ]
    const result = aggregateWorkload(tasks)

    // undefined and '' both fall through to 'unassigned'
    expect(result['unassigned'].total).toBe(3)
    expect(result['forge'].total).toBe(1)
  })

  it('should default missing status to "planning" and missing priority to "normal"', () => {
    const tasks = [
      { assignedAgent: 'forge' },
      { assignedAgent: 'forge', status: undefined, priority: undefined },
    ]
    const result = aggregateWorkload(tasks)

    expect(result['forge'].total).toBe(2)
    expect(result['forge'].byStatus['planning']).toBe(2)
    expect(result['forge'].byPriority['normal']).toBe(2)
  })

  it('should return empty object for empty task list', () => {
    const result = aggregateWorkload([])
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('should handle many agents with varying task counts', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'planning', priority: 'normal' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'sentinel', status: 'in_review', priority: 'normal' },
      { assignedAgent: 'oracle', status: 'done', priority: 'low' },
      { assignedAgent: 'oracle', status: 'done', priority: 'normal' },
      { assignedAgent: 'oracle', status: 'blocked', priority: 'urgent' },
      { assignedAgent: 'friday', status: 'ready', priority: 'high' },
    ]
    const result = aggregateWorkload(tasks)

    expect(Object.keys(result)).toHaveLength(4)
    expect(result['forge'].total).toBe(2)
    expect(result['sentinel'].total).toBe(1)
    expect(result['oracle'].total).toBe(3)
    expect(result['friday'].total).toBe(1)

    // Cross-check: totals across all agents should match input count
    const totalAcrossAgents = Object.values(result).reduce((sum, w) => sum + w.total, 0)
    expect(totalAcrossAgents).toBe(7)
  })
})

describe('Workload View - getWorkload query handler', () => {
  it('should compute workload from database tasks', async () => {
    const tasks = [
      { _id: 't1', assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { _id: 't2', assignedAgent: 'forge', status: 'planning', priority: 'normal' },
      { _id: 't3', assignedAgent: 'sentinel', status: 'done', priority: 'low' },
    ]
    const ctx = mockCtx(tasks)
    const result = await getWorkloadHandler(ctx, {})

    expect(result['forge'].total).toBe(2)
    expect(result['forge'].byStatus['in_progress']).toBe(1)
    expect(result['forge'].byPriority['high']).toBe(1)
    expect(result['sentinel'].total).toBe(1)
    expect(result['sentinel'].byStatus['done']).toBe(1)
  })

  it('should return empty workload for empty database', async () => {
    const ctx = mockCtx([])
    const result = await getWorkloadHandler(ctx, {})
    expect(Object.keys(result)).toHaveLength(0)
  })
})
