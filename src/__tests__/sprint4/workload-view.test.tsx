/**
 * Sprint 4: Workload View Behavior Tests
 *
 * Tests exercise the actual aggregateWorkload() pure function exported
 * from convex/tasks.ts and the getWorkload query handler, verifying
 * that task counts per agent, per status, and per priority are computed
 * correctly from real task arrays.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../convex/_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
  internalMutation: (config: Record<string, unknown>) => config,
}))

import { aggregateWorkload } from '../../../convex/tasks'
import * as taskModule from '../../../convex/tasks'

type HandlerExtractor = { handler: (...args: any[]) => Promise<any> }
const getWorkloadHandler = (taskModule.getWorkload as unknown as HandlerExtractor).handler

function mockCtx(tasks: any[]) {
  return {
    auth: { getUserIdentity: async () => ({ subject: 'test-user' }) },
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

    // undefined, missing, and '' all fall through to 'unassigned'
    expect(result['unassigned'].total).toBe(3)
    expect(result['unassigned'].byStatus['planning']).toBe(1)
    expect(result['unassigned'].byStatus['ready']).toBe(1)
    expect(result['unassigned'].byStatus['blocked']).toBe(1)
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

  it('should handle many agents with varying task counts and cross-validate totals', () => {
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

    // Cross-check: sum of all agent totals == input count
    const totalAcrossAgents = Object.values(result).reduce((sum, w) => sum + w.total, 0)
    expect(totalAcrossAgents).toBe(7)
  })

  it('should have byStatus counts that sum to total for each agent', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'planning', priority: 'normal' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'done', priority: 'low' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'urgent' },
      { assignedAgent: 'sentinel', status: 'ready', priority: 'normal' },
      { assignedAgent: 'sentinel', status: 'blocked', priority: 'high' },
    ]
    const result = aggregateWorkload(tasks)

    // For each agent, sum of byStatus values must equal total
    for (const [, workload] of Object.entries(result)) {
      const statusSum = Object.values(workload.byStatus).reduce((s, c) => s + c, 0)
      expect(statusSum).toBe(workload.total)
    }

    // For each agent, sum of byPriority values must equal total
    for (const [, workload] of Object.entries(result)) {
      const prioritySum = Object.values(workload.byPriority).reduce((s, c) => s + c, 0)
      expect(prioritySum).toBe(workload.total)
    }
  })

  it('should aggregate a realistic mixed workload correctly', () => {
    // Simulate a real team workload
    const tasks = [
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'planning', priority: 'normal' },
      { assignedAgent: 'sentinel', status: 'in_review', priority: 'normal' },
      { assignedAgent: 'sentinel', status: 'in_review', priority: 'high' },
      { assignedAgent: 'sentinel', status: 'done', priority: 'low' },
      { assignedAgent: 'oracle', status: 'blocked', priority: 'urgent' },
      { status: 'planning', priority: 'low' }, // unassigned
    ]
    const result = aggregateWorkload(tasks)

    // Forge: 3 tasks, 2 in_progress + 1 planning, 2 high + 1 normal
    expect(result['forge'].total).toBe(3)
    expect(result['forge'].byStatus['in_progress']).toBe(2)
    expect(result['forge'].byStatus['planning']).toBe(1)
    expect(result['forge'].byPriority['high']).toBe(2)
    expect(result['forge'].byPriority['normal']).toBe(1)

    // Sentinel: 3 tasks, 2 in_review + 1 done
    expect(result['sentinel'].total).toBe(3)
    expect(result['sentinel'].byStatus['in_review']).toBe(2)
    expect(result['sentinel'].byStatus['done']).toBe(1)

    // Oracle: 1 blocked urgent task
    expect(result['oracle'].total).toBe(1)
    expect(result['oracle'].byStatus['blocked']).toBe(1)
    expect(result['oracle'].byPriority['urgent']).toBe(1)

    // Unassigned: 1 planning low task
    expect(result['unassigned'].total).toBe(1)
    expect(result['unassigned'].byStatus['planning']).toBe(1)
    expect(result['unassigned'].byPriority['low']).toBe(1)
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
    expect(result['forge'].byStatus['planning']).toBe(1)
    expect(result['forge'].byPriority['high']).toBe(1)
    expect(result['forge'].byPriority['normal']).toBe(1)
    expect(result['sentinel'].total).toBe(1)
    expect(result['sentinel'].byStatus['done']).toBe(1)
    expect(result['sentinel'].byPriority['low']).toBe(1)
  })

  it('should return empty workload for empty database', async () => {
    const ctx = mockCtx([])
    const result = await getWorkloadHandler(ctx, {})
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('should produce consistent results between handler and pure function', async () => {
    const tasks = [
      { _id: 't1', assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { _id: 't2', assignedAgent: 'oracle', status: 'done', priority: 'normal' },
      { _id: 't3', assignedAgent: 'forge', status: 'blocked', priority: 'urgent' },
    ]
    const ctx = mockCtx(tasks)

    const handlerResult = await getWorkloadHandler(ctx, {})
    const pureResult = aggregateWorkload(tasks)

    // Both should produce identical output
    expect(handlerResult['forge'].total).toBe(pureResult['forge'].total)
    expect(handlerResult['oracle'].total).toBe(pureResult['oracle'].total)
    expect(handlerResult['forge'].byStatus).toEqual(pureResult['forge'].byStatus)
    expect(handlerResult['forge'].byPriority).toEqual(pureResult['forge'].byPriority)
  })
})
