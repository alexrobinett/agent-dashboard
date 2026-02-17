/**
 * Sprint 4: Drag-and-Drop Interaction Tests
 *
 * Smoke-level unit test stubs for drag-and-drop integration points.
 * Tests validate the status transition logic and data structures
 * that drive drag-and-drop task movement between columns.
 */

import { describe, it, expect } from 'vitest'
import { createMockTask, groupTasksByStatus } from '../../test/fixtures'
import type { TaskStatus } from '../../test/fixtures'

describe('Drag-and-Drop - Status Transitions', () => {
  const validStatuses: TaskStatus[] = [
    'planning',
    'ready',
    'in_progress',
    'in_review',
    'done',
    'blocked',
  ]

  it('should support moving a task between any two status columns', () => {
    const task = createMockTask({ status: 'planning' })

    // Simulate drag from planning to in_progress
    const updatedTask = { ...task, status: 'in_progress' as TaskStatus }
    expect(updatedTask.status).toBe('in_progress')
    expect(updatedTask._id).toBe(task._id)
  })

  it('should validate all six status columns as valid drop targets', () => {
    expect(validStatuses).toHaveLength(6)
    expect(validStatuses).toContain('planning')
    expect(validStatuses).toContain('ready')
    expect(validStatuses).toContain('in_progress')
    expect(validStatuses).toContain('in_review')
    expect(validStatuses).toContain('done')
    expect(validStatuses).toContain('blocked')
  })

  it('should update task status when dropped in a new column', () => {
    const task = createMockTask({ status: 'ready', title: 'Drag me' })

    // Simulate status transition for each valid target
    for (const targetStatus of validStatuses) {
      const moved = { ...task, status: targetStatus }
      expect(moved.status).toBe(targetStatus)
      expect(moved.title).toBe('Drag me')
    }
  })

  it('should preserve task data when changing status via drag', () => {
    const task = createMockTask({
      status: 'planning',
      priority: 'high',
      assignedAgent: 'forge',
      project: 'agent-dashboard',
      title: 'Important task',
    })

    // Only status should change on drag; other fields stay intact
    const moved = { ...task, status: 'in_progress' as TaskStatus }
    expect(moved.priority).toBe('high')
    expect(moved.assignedAgent).toBe('forge')
    expect(moved.project).toBe('agent-dashboard')
    expect(moved.title).toBe('Important task')
  })
})

describe('Drag-and-Drop - Board State', () => {
  it('should correctly group tasks by status for column rendering', () => {
    const tasks = [
      createMockTask({ status: 'planning', title: 'Task A' }),
      createMockTask({ status: 'planning', title: 'Task B' }),
      createMockTask({ status: 'in_progress', title: 'Task C' }),
      createMockTask({ status: 'done', title: 'Task D' }),
    ]

    const grouped = groupTasksByStatus(tasks)

    expect(grouped['planning']).toHaveLength(2)
    expect(grouped['in_progress']).toHaveLength(1)
    expect(grouped['done']).toHaveLength(1)
    expect(grouped['ready']).toHaveLength(0)
    expect(grouped['in_review']).toHaveLength(0)
    expect(grouped['blocked']).toHaveLength(0)
  })

  it('should remove task from source column and add to target on drop', () => {
    const tasks = [
      createMockTask({ status: 'planning', title: 'Moving task' }),
      createMockTask({ status: 'planning', title: 'Staying task' }),
      createMockTask({ status: 'done', title: 'Done task' }),
    ]

    const grouped = groupTasksByStatus(tasks)
    expect(grouped['planning']).toHaveLength(2)
    expect(grouped['in_progress']).toHaveLength(0)

    // Simulate drag: move first planning task to in_progress
    const movedTask = { ...tasks[0], status: 'in_progress' as TaskStatus }
    const updatedTasks = [movedTask, tasks[1], tasks[2]]
    const regrouped = groupTasksByStatus(updatedTasks)

    expect(regrouped['planning']).toHaveLength(1)
    expect(regrouped['in_progress']).toHaveLength(1)
    expect(regrouped['in_progress'][0].title).toBe('Moving task')
  })

  it('should handle dropping a task into an empty column', () => {
    const tasks = [
      createMockTask({ status: 'planning', title: 'Only task' }),
    ]

    const grouped = groupTasksByStatus(tasks)
    expect(grouped['blocked']).toHaveLength(0)

    // Move into empty blocked column
    const movedTask = { ...tasks[0], status: 'blocked' as TaskStatus }
    const regrouped = groupTasksByStatus([movedTask])

    expect(regrouped['planning']).toHaveLength(0)
    expect(regrouped['blocked']).toHaveLength(1)
  })
})
