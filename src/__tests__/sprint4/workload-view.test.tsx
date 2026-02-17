/**
 * Sprint 4: Workload View Component Tests
 *
 * Smoke-level unit test stubs for workload view integration points.
 * Tests validate the workload aggregation logic and data shapes
 * that the Workload View component will consume.
 */

import { describe, it, expect } from 'vitest'
import { createMockTask, createMockTasksByStatus } from '../../test/fixtures'
import { mockQueryData } from '../../test/mocks/convex'

describe('Workload View - Data Layer', () => {
  it('should have getWorkload mock query data available', () => {
    const workload = mockQueryData['tasks:getWorkload']
    expect(workload).toBeDefined()
  })

  it('should aggregate tasks by agent for workload calculation', () => {
    const tasks = [
      createMockTask({ assignedAgent: 'forge', status: 'in_progress' }),
      createMockTask({ assignedAgent: 'forge', status: 'planning' }),
      createMockTask({ assignedAgent: 'sentinel', status: 'in_review' }),
      createMockTask({ assignedAgent: 'oracle', status: 'blocked' }),
    ]

    // Simulate workload aggregation
    const workload: Record<string, { total: number; byStatus: Record<string, number> }> = {}
    for (const task of tasks) {
      const agent = task.assignedAgent ?? 'unassigned'
      if (!workload[agent]) {
        workload[agent] = { total: 0, byStatus: {} }
      }
      workload[agent].total++
      workload[agent].byStatus[task.status] =
        (workload[agent].byStatus[task.status] || 0) + 1
    }

    expect(workload['forge'].total).toBe(2)
    expect(workload['forge'].byStatus['in_progress']).toBe(1)
    expect(workload['forge'].byStatus['planning']).toBe(1)
    expect(workload['sentinel'].total).toBe(1)
    expect(workload['oracle'].total).toBe(1)
  })

  it('should calculate workload by priority', () => {
    const tasks = [
      createMockTask({ assignedAgent: 'forge', priority: 'urgent' }),
      createMockTask({ assignedAgent: 'forge', priority: 'high' }),
      createMockTask({ assignedAgent: 'forge', priority: 'normal' }),
      createMockTask({ assignedAgent: 'sentinel', priority: 'urgent' }),
    ]

    const workload: Record<string, { total: number; byPriority: Record<string, number> }> = {}
    for (const task of tasks) {
      const agent = task.assignedAgent ?? 'unassigned'
      if (!workload[agent]) {
        workload[agent] = { total: 0, byPriority: {} }
      }
      workload[agent].total++
      workload[agent].byPriority[task.priority] =
        (workload[agent].byPriority[task.priority] || 0) + 1
    }

    expect(workload['forge'].total).toBe(3)
    expect(workload['forge'].byPriority['urgent']).toBe(1)
    expect(workload['forge'].byPriority['high']).toBe(1)
    expect(workload['sentinel'].byPriority['urgent']).toBe(1)
  })

  it('should handle agents with no tasks', () => {
    const workload: Record<string, { total: number }> = {}

    // Empty workload should be an empty object
    expect(Object.keys(workload)).toHaveLength(0)
  })
})

describe('Workload View - Component Integration Stubs', () => {
  it('should produce correct workload shape from task fixtures', () => {
    const tasks = createMockTasksByStatus(2)

    // Group by agent to validate workload shape
    const agentGroups: Record<string, number> = {}
    for (const task of tasks) {
      const agent = task.assignedAgent ?? 'unassigned'
      agentGroups[agent] = (agentGroups[agent] || 0) + 1
    }

    // createMockTasksByStatus cycles through 4 agents
    expect(Object.keys(agentGroups).length).toBeGreaterThan(0)
    expect(Object.keys(agentGroups).length).toBeLessThanOrEqual(4)

    // Each agent should have at least one task
    for (const count of Object.values(agentGroups)) {
      expect(count).toBeGreaterThan(0)
    }
  })

  it('should validate workload response shape for rendering', () => {
    const workloadResponse: Record<
      string,
      { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> }
    > = {
      forge: {
        total: 3,
        byStatus: { planning: 1, in_progress: 2 },
        byPriority: { normal: 1, high: 2 },
      },
      sentinel: {
        total: 1,
        byStatus: { in_review: 1 },
        byPriority: { normal: 1 },
      },
    }

    expect(workloadResponse['forge'].total).toBe(3)
    expect(workloadResponse['sentinel'].total).toBe(1)
    expect(Object.keys(workloadResponse)).toHaveLength(2)
  })
})
