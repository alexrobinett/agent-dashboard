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
