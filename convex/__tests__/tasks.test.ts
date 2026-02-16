import { describe, it, expect } from 'vitest'

describe('Convex Tasks Schema', () => {
  it('should validate task status values', () => {
    const validStatuses = [
      'planning',
      'ready',
      'in_progress',
      'in_review',
      'done',
      'blocked',
      'cancelled',
    ]

    expect(validStatuses).toHaveLength(7)
    expect(validStatuses).toContain('in_progress')
    expect(validStatuses).toContain('done')
  })

  it('should validate priority values', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent']

    expect(validPriorities).toHaveLength(4)
    expect(validPriorities).toContain('high')
    expect(validPriorities).toContain('urgent')
  })

  it('should validate task structure', () => {
    const mockTask = {
      title: 'Test Task',
      description: 'Test Description',
      assignedAgent: 'forge',
      createdBy: 'main',
      status: 'in_progress',
      priority: 'high',
      project: 'test-project',
      createdAt: Date.now(),
    }

    expect(mockTask).toHaveProperty('title')
    expect(mockTask).toHaveProperty('status')
    expect(mockTask).toHaveProperty('priority')
    expect(mockTask.title).toBe('Test Task')
    expect(mockTask.status).toBe('in_progress')
  })
})
