/**
 * Test Fixtures Unit Tests
 * Sprint 3.4: Shared test utilities
 */

import { describe, it, expect } from 'vitest'
import {
  createMockTask,
  createMockTasksByStatus,
  createMockHandoffTask,
  createMockBlockedTask,
  createMockTaskWithDependencies,
  groupTasksByStatus,
} from '../fixtures'

describe('createMockTask', () => {
  it('should create task with default values', () => {
    const task = createMockTask()
    
    expect(task).toHaveProperty('_id')
    expect(task).toHaveProperty('_creationTime')
    expect(task.title).toBe('Mock Task')
    expect(task.status).toBe('planning')
    expect(task.priority).toBe('normal')
    expect(task.assignedAgent).toBe('unassigned')
    expect(task.createdBy).toBe('main')
  })

  it('should accept partial overrides', () => {
    const task = createMockTask({
      title: 'Custom Title',
      status: 'in_progress',
      priority: 'high',
      assignedAgent: 'forge',
    })
    
    expect(task.title).toBe('Custom Title')
    expect(task.status).toBe('in_progress')
    expect(task.priority).toBe('high')
    expect(task.assignedAgent).toBe('forge')
  })

  it('should support all optional fields', () => {
    const task = createMockTask({
      description: 'Test description',
      notes: 'Test notes',
      project: 'agent-dashboard',
      blockedReason: 'Waiting for review',
      leaseOwner: 'forge-task123',
      version: 5,
    })
    
    expect(task.description).toBe('Test description')
    expect(task.notes).toBe('Test notes')
    expect(task.project).toBe('agent-dashboard')
    expect(task.blockedReason).toBe('Waiting for review')
    expect(task.leaseOwner).toBe('forge-task123')
    expect(task.version).toBe(5)
  })

  it('should support dependsOn array', () => {
    const task = createMockTask({
      dependsOn: ['j57abc123' as any, 'j57def456' as any],
    })
    
    expect(task.dependsOn).toHaveLength(2)
    expect(task.dependsOn![0]).toBe('j57abc123')
    expect(task.dependsOn![1]).toBe('j57def456')
  })

  it('should support handoffPayload object', () => {
    const task = createMockTask({
      handoffPayload: {
        contextSummary: 'Test summary',
        filesChanged: ['file1.ts', 'file2.tsx'],
        testsPassed: true,
        remainingRisk: 'Low',
      },
    })
    
    expect(task.handoffPayload).toBeDefined()
    expect(task.handoffPayload!.contextSummary).toBe('Test summary')
    expect(task.handoffPayload!.filesChanged).toHaveLength(2)
    expect(task.handoffPayload!.testsPassed).toBe(true)
    expect(task.handoffPayload!.remainingRisk).toBe('Low')
  })
})

describe('createMockTasksByStatus', () => {
  it('should create tasks for all statuses', () => {
    const tasks = createMockTasksByStatus(1)
    
    const statuses = tasks.map(t => t.status)
    expect(statuses).toContain('planning')
    expect(statuses).toContain('ready')
    expect(statuses).toContain('in_progress')
    expect(statuses).toContain('in_review')
    expect(statuses).toContain('done')
    expect(statuses).toContain('blocked')
    expect(tasks).toHaveLength(6)
  })

  it('should create multiple tasks per status', () => {
    const tasks = createMockTasksByStatus(3)
    
    const planningTasks = tasks.filter(t => t.status === 'planning')
    expect(planningTasks).toHaveLength(3)
  })

  it('should alternate priorities', () => {
    const tasks = createMockTasksByStatus(2)
    const planningTasks = tasks.filter(t => t.status === 'planning')
    
    expect(planningTasks[0].priority).toBe('normal')
    expect(planningTasks[1].priority).toBe('high')
  })
})

describe('createMockHandoffTask', () => {
  it('should create task with handoff payload', () => {
    const task = createMockHandoffTask()
    
    expect(task.status).toBe('in_review')
    expect(task.assignedAgent).toBe('sentinel')
    expect(task.handoffCount).toBe(1)
    expect(task.handoffPayload).toBeDefined()
    expect(task.leaseOwner).toBeDefined()
    expect(task.leaseExpiresAt).toBeDefined()
  })

  it('should accept overrides', () => {
    const task = createMockHandoffTask({
      assignedAgent: 'forge',
      handoffCount: 3,
    })
    
    expect(task.assignedAgent).toBe('forge')
    expect(task.handoffCount).toBe(3)
  })
})

describe('createMockBlockedTask', () => {
  it('should create blocked task', () => {
    const task = createMockBlockedTask()
    
    expect(task.status).toBe('blocked')
    expect(task.priority).toBe('urgent')
    expect(task.blockedReason).toBeDefined()
    expect(task.dependsOn).toBeDefined()
  })

  it('should accept overrides', () => {
    const task = createMockBlockedTask({
      blockedReason: 'Custom block reason',
      priority: 'normal',
    })
    
    expect(task.blockedReason).toBe('Custom block reason')
    expect(task.priority).toBe('normal')
  })
})

describe('createMockTaskWithDependencies', () => {
  it('should create task with dependencies', () => {
    const task = createMockTaskWithDependencies(2)
    
    expect(task.dependsOn).toHaveLength(2)
    expect(task.dependsOn).toBeDefined()
  })

  it('should create custom number of dependencies', () => {
    const task = createMockTaskWithDependencies(5)
    
    expect(task.dependsOn).toHaveLength(5)
  })

  it('should accept overrides', () => {
    const task = createMockTaskWithDependencies(2, {
      title: 'Custom Dependent Task',
      status: 'blocked',
    })
    
    expect(task.title).toBe('Custom Dependent Task')
    expect(task.status).toBe('blocked')
    expect(task.dependsOn).toHaveLength(2)
  })
})

describe('groupTasksByStatus', () => {
  it('should group tasks by status', () => {
    const tasks = createMockTasksByStatus(1)
    const grouped = groupTasksByStatus(tasks)
    
    expect(grouped.planning).toHaveLength(1)
    expect(grouped.ready).toHaveLength(1)
    expect(grouped.in_progress).toHaveLength(1)
    expect(grouped.in_review).toHaveLength(1)
    expect(grouped.done).toHaveLength(1)
    expect(grouped.blocked).toHaveLength(1)
  })

  it('should handle empty task list', () => {
    const grouped = groupTasksByStatus([])
    
    expect(grouped.planning).toHaveLength(0)
    expect(grouped.ready).toHaveLength(0)
  })

  it('should handle tasks with same status', () => {
    const tasks = [
      createMockTask({ status: 'in_progress' }),
      createMockTask({ status: 'in_progress' }),
      createMockTask({ status: 'in_progress' }),
    ]
    
    const grouped = groupTasksByStatus(tasks)
    
    expect(grouped.in_progress).toHaveLength(3)
    expect(grouped.ready).toHaveLength(0)
  })
})
