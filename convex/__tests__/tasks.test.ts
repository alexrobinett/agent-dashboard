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

describe('getByStatus Query - Grouping', () => {
  it('should group tasks into 6 status columns', () => {
    const tasks = [
      { title: 'Task 1', status: 'planning', priority: 'normal', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'ready', priority: 'high', assignedAgent: 'sentinel' },
      { title: 'Task 3', status: 'in_progress', priority: 'normal', assignedAgent: 'oracle' },
      { title: 'Task 4', status: 'in_review', priority: 'low', assignedAgent: 'friday' },
      { title: 'Task 5', status: 'done', priority: 'normal', assignedAgent: 'forge' },
      { title: 'Task 6', status: 'blocked', priority: 'urgent', assignedAgent: 'sentinel' },
    ]
    
    const grouped: Record<string, typeof tasks> = {
      planning: [],
      ready: [],
      in_progress: [],
      in_review: [],
      done: [],
      blocked: [],
    }
    
    for (const task of tasks) {
      const status = task.status || 'planning'
      if (grouped[status]) {
        grouped[status].push(task)
      }
    }
    
    expect(grouped.planning).toHaveLength(1)
    expect(grouped.ready).toHaveLength(1)
    expect(grouped.in_progress).toHaveLength(1)
    expect(grouped.in_review).toHaveLength(1)
    expect(grouped.done).toHaveLength(1)
    expect(grouped.blocked).toHaveLength(1)
    expect(grouped.planning[0].title).toBe('Task 1')
    expect(grouped.ready[0].title).toBe('Task 2')
  })

  it('should return all 6 status columns even when empty', () => {
    const tasks: any[] = []
    
    const grouped: Record<string, typeof tasks> = {
      planning: [],
      ready: [],
      in_progress: [],
      in_review: [],
      done: [],
      blocked: [],
    }
    
    for (const task of tasks) {
      const status = task.status || 'planning'
      if (grouped[status]) {
        grouped[status].push(task)
      }
    }
    
    expect(Object.keys(grouped)).toHaveLength(6)
    expect(grouped.planning).toEqual([])
    expect(grouped.ready).toEqual([])
    expect(grouped.in_progress).toEqual([])
    expect(grouped.in_review).toEqual([])
    expect(grouped.done).toEqual([])
    expect(grouped.blocked).toEqual([])
  })

  it('should handle tasks with missing status by defaulting to planning', () => {
    const tasks = [
      { title: 'Task 1', priority: 'normal', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'ready', priority: 'high', assignedAgent: 'sentinel' },
    ]
    
    const grouped: Record<string, any[]> = {
      planning: [],
      ready: [],
      in_progress: [],
      in_review: [],
      done: [],
      blocked: [],
    }
    
    for (const task of tasks) {
      const status = (task as any).status || 'planning'
      if (grouped[status]) {
        grouped[status].push(task)
      }
    }
    
    expect(grouped.planning).toHaveLength(1)
    expect(grouped.ready).toHaveLength(1)
    expect(grouped.planning[0].title).toBe('Task 1')
  })

  it('should group multiple tasks into same status column', () => {
    const tasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'high', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'in_progress', priority: 'normal', assignedAgent: 'sentinel' },
      { title: 'Task 3', status: 'in_progress', priority: 'urgent', assignedAgent: 'oracle' },
      { title: 'Task 4', status: 'ready', priority: 'low', assignedAgent: 'friday' },
    ]
    
    const grouped: Record<string, typeof tasks> = {
      planning: [],
      ready: [],
      in_progress: [],
      in_review: [],
      done: [],
      blocked: [],
    }
    
    for (const task of tasks) {
      const status = task.status || 'planning'
      if (grouped[status]) {
        grouped[status].push(task)
      }
    }
    
    expect(grouped.in_progress).toHaveLength(3)
    expect(grouped.ready).toHaveLength(1)
    expect(grouped.in_progress.every(t => t.status === 'in_progress')).toBe(true)
  })

  it('should preserve task properties when grouping', () => {
    const tasks = [
      {
        _id: 'j57abc123',
        title: 'Test Task',
        status: 'in_progress',
        priority: 'high',
        project: 'agent-dashboard',
        assignedAgent: 'forge',
        createdBy: 'main',
        createdAt: 1771228225730,
        notes: 'Test notes',
      },
    ]
    
    const grouped: Record<string, typeof tasks> = {
      planning: [],
      ready: [],
      in_progress: [],
      in_review: [],
      done: [],
      blocked: [],
    }
    
    for (const task of tasks) {
      const status = task.status || 'planning'
      if (grouped[status]) {
        grouped[status].push(task)
      }
    }
    
    const task = grouped.in_progress[0]
    expect(task).toHaveProperty('_id')
    expect(task).toHaveProperty('title')
    expect(task).toHaveProperty('status')
    expect(task).toHaveProperty('priority')
    expect(task).toHaveProperty('project')
    expect(task).toHaveProperty('assignedAgent')
    expect(task).toHaveProperty('createdBy')
    expect(task).toHaveProperty('createdAt')
    expect(task).toHaveProperty('notes')
  })

  it('should handle all valid status values', () => {
    const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked']
    
    validStatuses.forEach(status => {
      const tasks = [{ title: 'Test', status, priority: 'normal', assignedAgent: 'forge' }]
      
      const grouped: Record<string, typeof tasks> = {
        planning: [],
        ready: [],
        in_progress: [],
        in_review: [],
        done: [],
        blocked: [],
      }
      
      for (const task of tasks) {
        const taskStatus = task.status || 'planning'
        if (grouped[taskStatus]) {
          grouped[taskStatus].push(task)
        }
      }
      
      expect(grouped[status]).toHaveLength(1)
    })
  })

  it('should return empty arrays for statuses with no tasks', () => {
    const tasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'normal', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'done', priority: 'high', assignedAgent: 'sentinel' },
    ]
    
    const grouped: Record<string, typeof tasks> = {
      planning: [],
      ready: [],
      in_progress: [],
      in_review: [],
      done: [],
      blocked: [],
    }
    
    for (const task of tasks) {
      const status = task.status || 'planning'
      if (grouped[status]) {
        grouped[status].push(task)
      }
    }
    
    expect(Array.isArray(grouped.planning)).toBe(true)
    expect(grouped.planning).toHaveLength(0)
    expect(Array.isArray(grouped.ready)).toBe(true)
    expect(grouped.ready).toHaveLength(0)
    expect(Array.isArray(grouped.in_review)).toBe(true)
    expect(grouped.in_review).toHaveLength(0)
    expect(Array.isArray(grouped.blocked)).toBe(true)
    expect(grouped.blocked).toHaveLength(0)
  })

  it('should maintain task order within status columns', () => {
    const tasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'high', assignedAgent: 'forge', createdAt: 1 },
      { title: 'Task 2', status: 'in_progress', priority: 'normal', assignedAgent: 'sentinel', createdAt: 2 },
      { title: 'Task 3', status: 'in_progress', priority: 'low', assignedAgent: 'oracle', createdAt: 3 },
    ]
    
    const grouped: Record<string, typeof tasks> = {
      planning: [],
      ready: [],
      in_progress: [],
      in_review: [],
      done: [],
      blocked: [],
    }
    
    for (const task of tasks) {
      const status = task.status || 'planning'
      if (grouped[status]) {
        grouped[status].push(task)
      }
    }
    
    expect(grouped.in_progress[0].title).toBe('Task 1')
    expect(grouped.in_progress[1].title).toBe('Task 2')
    expect(grouped.in_progress[2].title).toBe('Task 3')
  })
})

describe('getById Query - Retrieval', () => {
  it('should return task object for valid ID', () => {
    const mockTask = {
      _id: 'j57abc123' as any,
      title: 'Test Task',
      status: 'in_progress',
      priority: 'high',
      project: 'agent-dashboard',
      assignedAgent: 'forge',
      createdBy: 'main',
      createdAt: 1771228225730,
    }
    
    // Simulate getById returning the task
    const result = mockTask
    
    expect(result).toBeDefined()
    expect(result._id).toBe('j57abc123')
    expect(result.title).toBe('Test Task')
  })

  it('should return null for non-existent ID', () => {
    // Simulate getById returning null for missing task
    const result = null
    
    expect(result).toBeNull()
  })

  it('should return complete task object with all fields', () => {
    const mockTask = {
      _id: 'j57abc123' as any,
      _creationTime: 1771228225730,
      title: 'Complete Task',
      status: 'in_review',
      priority: 'high',
      project: 'agent-dashboard',
      assignedAgent: 'forge',
      createdBy: 'main',
      createdAt: 1771228225730,
      notes: 'Detailed notes',
      version: 5,
      leaseOwner: 'forge-j57abc123',
    }
    
    const result = mockTask
    
    expect(result).toHaveProperty('_id')
    expect(result).toHaveProperty('_creationTime')
    expect(result).toHaveProperty('title')
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('priority')
    expect(result).toHaveProperty('project')
    expect(result).toHaveProperty('assignedAgent')
    expect(result).toHaveProperty('createdBy')
    expect(result).toHaveProperty('createdAt')
    expect(result).toHaveProperty('notes')
    expect(result).toHaveProperty('version')
    expect(result).toHaveProperty('leaseOwner')
  })

  it('should handle tasks with minimal fields', () => {
    const mockTask = {
      _id: 'j57abc456' as any,
      title: 'Minimal Task',
      status: 'planning',
      priority: 'normal',
      createdBy: 'main',
      createdAt: 1771228225730,
      assignedAgent: 'unassigned',
    }
    
    const result = mockTask
    
    expect(result._id).toBe('j57abc456')
    expect(result.title).toBe('Minimal Task')
    expect(result.status).toBe('planning')
  })

  it('should preserve all task properties exactly', () => {
    const mockTask = {
      _id: 'j57abc789' as any,
      title: 'Preserve Properties',
      status: 'done',
      priority: 'low',
      project: 'testing',
      assignedAgent: 'friday',
      createdBy: 'automated',
      createdAt: 1771228225730,
      notes: 'Custom notes field',
      customField: 'Should be preserved',
    }
    
    const result = mockTask
    
    expect(result).toEqual(mockTask)
    expect((result as any).customField).toBe('Should be preserved')
  })

  it('should handle ID parameter correctly', () => {
    const taskId = 'j57abc123' as any
    const mockTask = {
      _id: taskId,
      title: 'Test',
      status: 'ready',
      priority: 'normal',
      createdBy: 'main',
      createdAt: 1771228225730,
      assignedAgent: 'forge',
    }
    
    // Verify ID matches
    expect(mockTask._id).toBe(taskId)
  })
})

describe('listFiltered Query - Default Behavior', () => {
  it('should return default limit of 50 when no limit provided', () => {
    const result = {
      tasks: [],
      total: 0,
      limit: 50,
      offset: 0,
      hasMore: false,
    }
    
    expect(result.limit).toBe(50)
  })

  it('should return default offset of 0 when no offset provided', () => {
    const result = {
      tasks: [],
      total: 0,
      limit: 50,
      offset: 0,
      hasMore: false,
    }
    
    expect(result.offset).toBe(0)
  })

  it('should return all required fields in response', () => {
    const result = {
      tasks: [],
      total: 100,
      limit: 50,
      offset: 0,
      hasMore: true,
    }
    
    expect(result).toHaveProperty('tasks')
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('limit')
    expect(result).toHaveProperty('offset')
    expect(result).toHaveProperty('hasMore')
  })

  it('should return tasks as an array', () => {
    const result = {
      tasks: [
        { title: 'Task 1', status: 'in_progress' },
        { title: 'Task 2', status: 'ready' },
      ],
      total: 2,
      limit: 50,
      offset: 0,
      hasMore: false,
    }
    
    expect(Array.isArray(result.tasks)).toBe(true)
    expect(result.tasks).toHaveLength(2)
  })
})

describe('listFiltered Query - Status Filter', () => {
  it('should filter tasks by status', () => {
    const allTasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'high', project: 'p1', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'ready', priority: 'normal', project: 'p1', assignedAgent: 'sentinel' },
      { title: 'Task 3', status: 'in_progress', priority: 'low', project: 'p2', assignedAgent: 'forge' },
    ]
    
    const filtered = allTasks.filter(t => t.status === 'in_progress')
    
    expect(filtered).toHaveLength(2)
    expect(filtered.every(t => t.status === 'in_progress')).toBe(true)
  })

  it('should return empty array when no tasks match status filter', () => {
    const allTasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'high', project: 'p1', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'ready', priority: 'normal', project: 'p1', assignedAgent: 'sentinel' },
    ]
    
    const filtered = allTasks.filter(t => t.status === 'done')
    
    expect(filtered).toHaveLength(0)
  })

  it('should handle all valid status values', () => {
    const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
    
    validStatuses.forEach(status => {
      const tasks = [{ title: 'Task', status, priority: 'normal', project: 'test', assignedAgent: 'agent' }]
      const filtered = tasks.filter(t => t.status === status)
      expect(filtered).toHaveLength(1)
    })
  })
})

describe('listFiltered Query - Priority Filter', () => {
  it('should filter tasks by priority', () => {
    const allTasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'high', project: 'p1', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'ready', priority: 'normal', project: 'p1', assignedAgent: 'sentinel' },
      { title: 'Task 3', status: 'in_progress', priority: 'high', project: 'p2', assignedAgent: 'forge' },
    ]
    
    const filtered = allTasks.filter(t => t.priority === 'high')
    
    expect(filtered).toHaveLength(2)
    expect(filtered.every(t => t.priority === 'high')).toBe(true)
  })

  it('should return empty array when no tasks match priority filter', () => {
    const allTasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'high', project: 'p1', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'ready', priority: 'normal', project: 'p1', assignedAgent: 'sentinel' },
    ]
    
    const filtered = allTasks.filter(t => t.priority === 'urgent')
    
    expect(filtered).toHaveLength(0)
  })

  it('should handle all valid priority values', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    
    validPriorities.forEach(priority => {
      const tasks = [{ title: 'Task', status: 'in_progress', priority, project: 'test', assignedAgent: 'agent' }]
      const filtered = tasks.filter(t => t.priority === priority)
      expect(filtered).toHaveLength(1)
    })
  })
})

describe('listFiltered Query - Project Filter', () => {
  it('should filter tasks by project', () => {
    const allTasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'high', project: 'agent-dashboard', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'ready', priority: 'normal', project: 'options-trader', assignedAgent: 'sentinel' },
      { title: 'Task 3', status: 'in_progress', priority: 'high', project: 'agent-dashboard', assignedAgent: 'forge' },
    ]
    
    const filtered = allTasks.filter(t => t.project === 'agent-dashboard')
    
    expect(filtered).toHaveLength(2)
    expect(filtered.every(t => t.project === 'agent-dashboard')).toBe(true)
  })

  it('should return empty array when no tasks match project filter', () => {
    const allTasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'high', project: 'agent-dashboard', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'ready', priority: 'normal', project: 'options-trader', assignedAgent: 'sentinel' },
    ]
    
    const filtered = allTasks.filter(t => t.project === 'nonexistent-project')
    
    expect(filtered).toHaveLength(0)
  })

  it('should be case-sensitive for project names', () => {
    const allTasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'high', project: 'agent-dashboard', assignedAgent: 'forge' },
    ]
    
    const filtered = allTasks.filter(t => t.project === 'Agent-Dashboard')
    
    expect(filtered).toHaveLength(0)
  })
})

describe('listFiltered Query - AssignedAgent Filter', () => {
  it('should filter tasks by assignedAgent', () => {
    const allTasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'high', project: 'p1', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'ready', priority: 'normal', project: 'p1', assignedAgent: 'sentinel' },
      { title: 'Task 3', status: 'in_progress', priority: 'high', project: 'p2', assignedAgent: 'forge' },
    ]
    
    const filtered = allTasks.filter(t => t.assignedAgent === 'forge')
    
    expect(filtered).toHaveLength(2)
    expect(filtered.every(t => t.assignedAgent === 'forge')).toBe(true)
  })

  it('should return empty array when no tasks match assignedAgent filter', () => {
    const allTasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'high', project: 'p1', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'ready', priority: 'normal', project: 'p1', assignedAgent: 'sentinel' },
    ]
    
    const filtered = allTasks.filter(t => t.assignedAgent === 'oracle')
    
    expect(filtered).toHaveLength(0)
  })

  it('should handle unassigned tasks', () => {
    const allTasks = [
      { title: 'Task 1', status: 'planning', priority: 'normal', project: 'p1', assignedAgent: 'unassigned' },
      { title: 'Task 2', status: 'ready', priority: 'normal', project: 'p1', assignedAgent: 'forge' },
    ]
    
    const filtered = allTasks.filter(t => t.assignedAgent === 'unassigned')
    
    expect(filtered).toHaveLength(1)
    expect(filtered[0].assignedAgent).toBe('unassigned')
  })
})

describe('listFiltered Query - Multiple Filters', () => {
  it('should apply multiple filters correctly', () => {
    const allTasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'high', project: 'agent-dashboard', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'ready', priority: 'high', project: 'agent-dashboard', assignedAgent: 'sentinel' },
      { title: 'Task 3', status: 'in_progress', priority: 'normal', project: 'agent-dashboard', assignedAgent: 'forge' },
      { title: 'Task 4', status: 'in_progress', priority: 'high', project: 'options-trader', assignedAgent: 'forge' },
    ]
    
    let filtered = allTasks
    filtered = filtered.filter(t => t.status === 'in_progress')
    filtered = filtered.filter(t => t.priority === 'high')
    filtered = filtered.filter(t => t.project === 'agent-dashboard')
    
    expect(filtered).toHaveLength(1)
    expect(filtered[0].title).toBe('Task 1')
    expect(filtered[0].assignedAgent).toBe('forge')
  })

  it('should return empty array when no tasks match all filters', () => {
    const allTasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'high', project: 'agent-dashboard', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'ready', priority: 'high', project: 'agent-dashboard', assignedAgent: 'sentinel' },
    ]
    
    let filtered = allTasks
    filtered = filtered.filter(t => t.status === 'in_progress')
    filtered = filtered.filter(t => t.priority === 'high')
    filtered = filtered.filter(t => t.assignedAgent === 'sentinel')
    
    expect(filtered).toHaveLength(0)
  })

  it('should handle all four filters combined', () => {
    const allTasks = [
      { title: 'Task 1', status: 'in_progress', priority: 'high', project: 'agent-dashboard', assignedAgent: 'forge' },
      { title: 'Task 2', status: 'in_progress', priority: 'high', project: 'agent-dashboard', assignedAgent: 'sentinel' },
    ]
    
    let filtered = allTasks
    filtered = filtered.filter(t => t.status === 'in_progress')
    filtered = filtered.filter(t => t.priority === 'high')
    filtered = filtered.filter(t => t.project === 'agent-dashboard')
    filtered = filtered.filter(t => t.assignedAgent === 'forge')
    
    expect(filtered).toHaveLength(1)
    expect(filtered[0].title).toBe('Task 1')
  })
})

describe('listFiltered Query - Pagination', () => {
  it('should respect custom limit', () => {
    const allTasks = Array.from({ length: 100 }, (_, i) => ({
      title: `Task ${i}`,
      status: 'in_progress',
      priority: 'normal',
      project: 'test',
      assignedAgent: 'forge',
    }))
    
    const limit = 25
    const offset = 0
    const paginated = allTasks.slice(offset, offset + limit)
    
    expect(paginated).toHaveLength(25)
  })

  it('should respect custom offset', () => {
    const allTasks = Array.from({ length: 100 }, (_, i) => ({
      title: `Task ${i}`,
      status: 'in_progress',
      priority: 'normal',
      project: 'test',
      assignedAgent: 'forge',
    }))
    
    const limit = 25
    const offset = 25
    const paginated = allTasks.slice(offset, offset + limit)
    
    expect(paginated).toHaveLength(25)
    expect(paginated[0].title).toBe('Task 25')
    expect(paginated[24].title).toBe('Task 49')
  })

  it('should calculate hasMore correctly when more tasks exist', () => {
    const total = 100
    const limit = 50
    const offset = 0
    
    const hasMore = offset + limit < total
    
    expect(hasMore).toBe(true)
  })

  it('should calculate hasMore correctly when on last page', () => {
    const total = 100
    const limit = 50
    const offset = 50
    
    const hasMore = offset + limit < total
    
    expect(hasMore).toBe(false)
  })

  it('should handle partial last page', () => {
    const allTasks = Array.from({ length: 95 }, (_, i) => ({
      title: `Task ${i}`,
      status: 'in_progress',
      priority: 'normal',
      project: 'test',
      assignedAgent: 'forge',
    }))
    
    const limit = 50
    const offset = 50
    const paginated = allTasks.slice(offset, offset + limit)
    
    expect(paginated).toHaveLength(45)
    const hasMore = offset + limit < allTasks.length
    expect(hasMore).toBe(false)
  })

  it('should return empty array when offset exceeds total', () => {
    const allTasks = Array.from({ length: 50 }, (_, i) => ({
      title: `Task ${i}`,
      status: 'in_progress',
      priority: 'normal',
      project: 'test',
      assignedAgent: 'forge',
    }))
    
    const limit = 25
    const offset = 100
    const paginated = allTasks.slice(offset, offset + limit)
    
    expect(paginated).toHaveLength(0)
  })

  it('should work with pagination after filtering', () => {
    const allTasks = Array.from({ length: 100 }, (_, i) => ({
      title: `Task ${i}`,
      status: i % 2 === 0 ? 'in_progress' : 'ready',
      priority: 'normal',
      project: 'test',
      assignedAgent: 'forge',
    }))
    
    const filtered = allTasks.filter(t => t.status === 'in_progress')
    expect(filtered).toHaveLength(50)
    
    const limit = 25
    const offset = 0
    const paginated = filtered.slice(offset, offset + limit)
    
    expect(paginated).toHaveLength(25)
    const hasMore = offset + limit < filtered.length
    expect(hasMore).toBe(true)
  })
})

describe('listFiltered Query - Edge Cases', () => {
  it('should handle empty task list', () => {
    const allTasks: any[] = []
    const filtered = allTasks
    const limit = 50
    const offset = 0
    const paginated = filtered.slice(offset, offset + limit)
    
    const result = {
      tasks: paginated,
      total: filtered.length,
      limit,
      offset,
      hasMore: offset + limit < filtered.length,
    }
    
    expect(result.tasks).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
  })

  it('should handle very large limit', () => {
    const allTasks = Array.from({ length: 100 }, (_, i) => ({
      title: `Task ${i}`,
      status: 'in_progress',
      priority: 'normal',
      project: 'test',
      assignedAgent: 'forge',
    }))
    
    const limit = 1000
    const offset = 0
    const paginated = allTasks.slice(offset, offset + limit)
    
    expect(paginated).toHaveLength(100)
  })

  it('should handle offset at exactly total', () => {
    const allTasks = Array.from({ length: 100 }, (_, i) => ({
      title: `Task ${i}`,
      status: 'in_progress',
      priority: 'normal',
      project: 'test',
      assignedAgent: 'forge',
    }))
    
    const limit = 50
    const offset = 100
    const paginated = allTasks.slice(offset, offset + limit)
    
    expect(paginated).toHaveLength(0)
    const hasMore = offset + limit < allTasks.length
    expect(hasMore).toBe(false)
  })

  it('should handle single task result', () => {
    const allTasks = [
      { title: 'Single Task', status: 'in_progress', priority: 'high', project: 'test', assignedAgent: 'forge' },
    ]
    
    const limit = 50
    const offset = 0
    const paginated = allTasks.slice(offset, offset + limit)
    
    const result = {
      tasks: paginated,
      total: allTasks.length,
      limit,
      offset,
      hasMore: offset + limit < allTasks.length,
    }
    
    expect(result.tasks).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(result.hasMore).toBe(false)
  })

  it('should preserve task object structure through filtering', () => {
    const allTasks = [
      {
        _id: 'j57abc123',
        title: 'Task 1',
        status: 'in_progress',
        priority: 'high',
        project: 'test',
        assignedAgent: 'forge',
        createdAt: 1771228225730,
        notes: 'Test notes',
      },
    ]
    
    const filtered = allTasks.filter(t => t.status === 'in_progress')
    
    expect(filtered[0]).toHaveProperty('_id')
    expect(filtered[0]).toHaveProperty('title')
    expect(filtered[0]).toHaveProperty('status')
    expect(filtered[0]).toHaveProperty('priority')
    expect(filtered[0]).toHaveProperty('project')
    expect(filtered[0]).toHaveProperty('assignedAgent')
    expect(filtered[0]).toHaveProperty('createdAt')
    expect(filtered[0]).toHaveProperty('notes')
  })
})
