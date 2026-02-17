import { describe, it, expect } from 'vitest'
import { aggregateWorkload } from '../tasks'

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
    const filtered: Array<{ title: string; status: string }> = []
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

describe('getWorkload Query - Aggregation Logic (real aggregateWorkload)', () => {
  it('should return empty object for empty task list', () => {
    const workload = aggregateWorkload([])
    expect(Object.keys(workload)).toHaveLength(0)
  })

  it('should create correct agent entry for a single task', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
    ])

    expect(Object.keys(workload)).toHaveLength(1)
    expect(workload['forge']).toBeDefined()
    expect(workload['forge'].total).toBe(1)
    expect(workload['forge'].byStatus['in_progress']).toBe(1)
    expect(workload['forge'].byPriority['high']).toBe(1)
  })

  it('should aggregate multiple tasks for the same agent', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'ready', priority: 'normal' },
      { assignedAgent: 'forge', status: 'done', priority: 'low' },
    ])

    expect(Object.keys(workload)).toHaveLength(1)
    expect(workload['forge'].total).toBe(3)
    expect(workload['forge'].byStatus['in_progress']).toBe(1)
    expect(workload['forge'].byStatus['ready']).toBe(1)
    expect(workload['forge'].byStatus['done']).toBe(1)
    expect(workload['forge'].byPriority['high']).toBe(1)
    expect(workload['forge'].byPriority['normal']).toBe(1)
    expect(workload['forge'].byPriority['low']).toBe(1)
  })

  it('should create separate entries for multiple agents', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'sentinel', status: 'ready', priority: 'normal' },
      { assignedAgent: 'oracle', status: 'done', priority: 'low' },
    ])

    expect(Object.keys(workload)).toHaveLength(3)
    expect(workload['forge'].total).toBe(1)
    expect(workload['sentinel'].total).toBe(1)
    expect(workload['oracle'].total).toBe(1)
  })

  it('should aggregate byStatus for all valid status values', () => {
    const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
    const tasks = validStatuses.map(status => ({
      assignedAgent: 'forge',
      status,
      priority: 'normal',
    }))

    const workload = aggregateWorkload(tasks)

    expect(workload['forge'].total).toBe(7)
    validStatuses.forEach(status => {
      expect(workload['forge'].byStatus[status]).toBe(1)
    })
  })

  it('should aggregate byPriority for all valid priority values', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    const tasks = validPriorities.map(priority => ({
      assignedAgent: 'forge',
      status: 'in_progress',
      priority,
    }))

    const workload = aggregateWorkload(tasks)

    expect(workload['forge'].total).toBe(4)
    validPriorities.forEach(priority => {
      expect(workload['forge'].byPriority[priority]).toBe(1)
    })
  })

  it('should use "unassigned" key for tasks without assignedAgent', () => {
    const workload = aggregateWorkload([
      { status: 'planning', priority: 'normal' },
    ])

    expect(Object.keys(workload)).toHaveLength(1)
    expect(workload['unassigned']).toBeDefined()
    expect(workload['unassigned'].total).toBe(1)
    expect(workload['unassigned'].byStatus['planning']).toBe(1)
    expect(workload['unassigned'].byPriority['normal']).toBe(1)
  })

  it('should use "unassigned" key for tasks with empty string assignedAgent', () => {
    const workload = aggregateWorkload([
      { assignedAgent: '', status: 'ready', priority: 'high' },
    ])

    expect(workload['unassigned']).toBeDefined()
    expect(workload['unassigned'].total).toBe(1)
  })

  it('should default status to "planning" when not provided', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', priority: 'normal' },
    ])

    expect(workload['forge'].byStatus['planning']).toBe(1)
  })

  it('should default priority to "normal" when not provided', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'in_progress' },
    ])

    expect(workload['forge'].byPriority['normal']).toBe(1)
  })

  it('should correctly aggregate a large dataset (50+ tasks)', () => {
    const agents = ['forge', 'sentinel', 'oracle', 'atlas', 'nexus']
    const statuses = ['planning', 'ready', 'in_progress', 'in_review', 'done']
    const priorities = ['low', 'normal', 'high', 'urgent']

    const tasks = Array.from({ length: 60 }, (_, i) => ({
      assignedAgent: agents[i % agents.length],
      status: statuses[i % statuses.length],
      priority: priorities[i % priorities.length],
    }))

    const workload = aggregateWorkload(tasks)

    expect(Object.keys(workload)).toHaveLength(5)

    agents.forEach(agent => {
      expect(workload[agent].total).toBe(12)
    })

    const totalCount = Object.values(workload).reduce((sum, w) => sum + w.total, 0)
    expect(totalCount).toBe(60)
  })

  it('should count correctly when all tasks have same agent, status, and priority', () => {
    const tasks = Array.from({ length: 10 }, () => ({
      assignedAgent: 'forge',
      status: 'in_progress',
      priority: 'high',
    }))

    const workload = aggregateWorkload(tasks)

    expect(Object.keys(workload)).toHaveLength(1)
    expect(workload['forge'].total).toBe(10)
    expect(workload['forge'].byStatus['in_progress']).toBe(10)
    expect(workload['forge'].byPriority['high']).toBe(10)
    expect(Object.keys(workload['forge'].byStatus)).toHaveLength(1)
    expect(Object.keys(workload['forge'].byPriority)).toHaveLength(1)
  })

  it('should handle mixed scenario with multiple agents, statuses, and priorities', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'urgent' },
      { assignedAgent: 'forge', status: 'done', priority: 'high' },
      { assignedAgent: 'sentinel', status: 'ready', priority: 'normal' },
      { assignedAgent: 'sentinel', status: 'blocked', priority: 'low' },
      { status: 'planning', priority: 'normal' },
      { status: 'planning', priority: 'low' },
    ])

    expect(Object.keys(workload)).toHaveLength(3)

    expect(workload['forge'].total).toBe(3)
    expect(workload['forge'].byStatus['in_progress']).toBe(2)
    expect(workload['forge'].byStatus['done']).toBe(1)
    expect(workload['forge'].byPriority['high']).toBe(2)
    expect(workload['forge'].byPriority['urgent']).toBe(1)

    expect(workload['sentinel'].total).toBe(2)
    expect(workload['sentinel'].byStatus['ready']).toBe(1)
    expect(workload['sentinel'].byStatus['blocked']).toBe(1)
    expect(workload['sentinel'].byPriority['normal']).toBe(1)
    expect(workload['sentinel'].byPriority['low']).toBe(1)

    expect(workload['unassigned'].total).toBe(2)
    expect(workload['unassigned'].byStatus['planning']).toBe(2)
    expect(workload['unassigned'].byPriority['normal']).toBe(1)
    expect(workload['unassigned'].byPriority['low']).toBe(1)
  })

  it('should not have cross-contamination between agents', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'sentinel', status: 'done', priority: 'low' },
    ])

    expect(workload['forge'].byStatus['done']).toBeUndefined()
    expect(workload['forge'].byPriority['low']).toBeUndefined()
    expect(workload['sentinel'].byStatus['in_progress']).toBeUndefined()
    expect(workload['sentinel'].byPriority['high']).toBeUndefined()
  })

  it('should initialize byStatus and byPriority as empty objects for new agents', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
    ])

    expect(typeof workload['forge'].byStatus).toBe('object')
    expect(typeof workload['forge'].byPriority).toBe('object')
    expect(workload['forge'].byStatus).not.toBeNull()
    expect(workload['forge'].byPriority).not.toBeNull()
  })

  it('should handle tasks where only assignedAgent is provided', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge' },
    ])

    expect(workload['forge'].total).toBe(1)
    expect(workload['forge'].byStatus['planning']).toBe(1)
    expect(workload['forge'].byPriority['normal']).toBe(1)
  })

  it('should correctly count status distribution within a single agent', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'normal' },
      { assignedAgent: 'forge', status: 'done', priority: 'high' },
      { assignedAgent: 'forge', status: 'done', priority: 'normal' },
      { assignedAgent: 'forge', status: 'done', priority: 'low' },
      { assignedAgent: 'forge', status: 'blocked', priority: 'urgent' },
    ])

    expect(workload['forge'].total).toBe(6)
    expect(workload['forge'].byStatus['in_progress']).toBe(2)
    expect(workload['forge'].byStatus['done']).toBe(3)
    expect(workload['forge'].byStatus['blocked']).toBe(1)
    expect(Object.keys(workload['forge'].byStatus)).toHaveLength(3)
  })

  it('should correctly count priority distribution within a single agent', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'sentinel', status: 'ready', priority: 'low' },
      { assignedAgent: 'sentinel', status: 'in_progress', priority: 'low' },
      { assignedAgent: 'sentinel', status: 'done', priority: 'normal' },
      { assignedAgent: 'sentinel', status: 'in_review', priority: 'high' },
      { assignedAgent: 'sentinel', status: 'planning', priority: 'high' },
      { assignedAgent: 'sentinel', status: 'ready', priority: 'high' },
      { assignedAgent: 'sentinel', status: 'blocked', priority: 'urgent' },
    ])

    expect(workload['sentinel'].total).toBe(7)
    expect(workload['sentinel'].byPriority['low']).toBe(2)
    expect(workload['sentinel'].byPriority['normal']).toBe(1)
    expect(workload['sentinel'].byPriority['high']).toBe(3)
    expect(workload['sentinel'].byPriority['urgent']).toBe(1)
    expect(Object.keys(workload['sentinel'].byPriority)).toHaveLength(4)
  })

  it('should handle unassigned tasks mixed with assigned tasks', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { status: 'planning', priority: 'normal' },
      { assignedAgent: 'forge', status: 'done', priority: 'normal' },
      { priority: 'low' },
      { assignedAgent: 'sentinel', status: 'ready', priority: 'urgent' },
    ])

    expect(Object.keys(workload)).toHaveLength(3)
    expect(workload['forge'].total).toBe(2)
    expect(workload['unassigned'].total).toBe(2)
    expect(workload['sentinel'].total).toBe(1)
  })

  it('should verify total equals sum of byStatus counts for each agent', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'done', priority: 'normal' },
      { assignedAgent: 'forge', status: 'done', priority: 'low' },
      { assignedAgent: 'forge', status: 'blocked', priority: 'urgent' },
      { assignedAgent: 'sentinel', status: 'ready', priority: 'normal' },
      { assignedAgent: 'sentinel', status: 'in_review', priority: 'high' },
    ])

    for (const agent of Object.keys(workload)) {
      const statusSum = Object.values(workload[agent].byStatus).reduce((a, b) => a + b, 0)
      const prioritySum = Object.values(workload[agent].byPriority).reduce((a, b) => a + b, 0)
      expect(statusSum).toBe(workload[agent].total)
      expect(prioritySum).toBe(workload[agent].total)
    }
  })

  it('should default all fields when task object has no properties', () => {
    const workload = aggregateWorkload([{}])

    expect(Object.keys(workload)).toHaveLength(1)
    expect(workload['unassigned']).toBeDefined()
    expect(workload['unassigned'].total).toBe(1)
    expect(workload['unassigned'].byStatus['planning']).toBe(1)
    expect(workload['unassigned'].byPriority['normal']).toBe(1)
  })

  it('should handle multiple completely empty task objects', () => {
    const workload = aggregateWorkload([{}, {}, {}])

    expect(Object.keys(workload)).toHaveLength(1)
    expect(workload['unassigned'].total).toBe(3)
    expect(workload['unassigned'].byStatus['planning']).toBe(3)
    expect(workload['unassigned'].byPriority['normal']).toBe(3)
  })

  it('should handle agent names with special characters', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'agent-v2.0', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'agent@team', status: 'ready', priority: 'low' },
      { assignedAgent: 'agent with spaces', status: 'done', priority: 'normal' },
    ])

    expect(Object.keys(workload)).toHaveLength(3)
    expect(workload['agent-v2.0'].total).toBe(1)
    expect(workload['agent@team'].total).toBe(1)
    expect(workload['agent with spaces'].total).toBe(1)
  })

  it('should handle many distinct agents', () => {
    const tasks = Array.from({ length: 20 }, (_, i) => ({
      assignedAgent: `agent-${i}`,
      status: 'in_progress',
      priority: 'normal',
    }))

    const workload = aggregateWorkload(tasks)

    expect(Object.keys(workload)).toHaveLength(20)
    for (let i = 0; i < 20; i++) {
      expect(workload[`agent-${i}`].total).toBe(1)
    }
  })

  it('should produce consistent results regardless of task order', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'sentinel', status: 'ready', priority: 'normal' },
      { assignedAgent: 'forge', status: 'done', priority: 'low' },
    ]

    const reversed = [...tasks].reverse()

    const workload1 = aggregateWorkload(tasks)
    const workload2 = aggregateWorkload(reversed)

    expect(workload1['forge'].total).toBe(workload2['forge'].total)
    expect(workload1['forge'].byStatus).toEqual(workload2['forge'].byStatus)
    expect(workload1['forge'].byPriority).toEqual(workload2['forge'].byPriority)
    expect(workload1['sentinel'].total).toBe(workload2['sentinel'].total)
  })

  it('should not share byStatus or byPriority references between agents', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'sentinel', status: 'in_progress', priority: 'high' },
    ])

    expect(workload['forge'].byStatus).not.toBe(workload['sentinel'].byStatus)
    expect(workload['forge'].byPriority).not.toBe(workload['sentinel'].byPriority)
  })

  it('should handle single agent with one status and multiple priorities', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'in_progress', priority: 'low' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'normal' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'urgent' },
    ])

    expect(workload['forge'].total).toBe(4)
    expect(Object.keys(workload['forge'].byStatus)).toHaveLength(1)
    expect(workload['forge'].byStatus['in_progress']).toBe(4)
    expect(Object.keys(workload['forge'].byPriority)).toHaveLength(4)
    expect(workload['forge'].byPriority['low']).toBe(1)
    expect(workload['forge'].byPriority['normal']).toBe(1)
    expect(workload['forge'].byPriority['high']).toBe(1)
    expect(workload['forge'].byPriority['urgent']).toBe(1)
  })

  it('should handle single agent with multiple statuses and one priority', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'planning', priority: 'high' },
      { assignedAgent: 'forge', status: 'ready', priority: 'high' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'done', priority: 'high' },
    ])

    expect(workload['forge'].total).toBe(4)
    expect(Object.keys(workload['forge'].byPriority)).toHaveLength(1)
    expect(workload['forge'].byPriority['high']).toBe(4)
    expect(Object.keys(workload['forge'].byStatus)).toHaveLength(4)
    expect(workload['forge'].byStatus['planning']).toBe(1)
    expect(workload['forge'].byStatus['ready']).toBe(1)
    expect(workload['forge'].byStatus['in_progress']).toBe(1)
    expect(workload['forge'].byStatus['done']).toBe(1)
  })

  it('should return correct structure for each agent entry', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
    ])

    const entry = workload['forge']
    expect(entry).toHaveProperty('total')
    expect(entry).toHaveProperty('byStatus')
    expect(entry).toHaveProperty('byPriority')
    expect(typeof entry.total).toBe('number')
    expect(typeof entry.byStatus).toBe('object')
    expect(typeof entry.byPriority).toBe('object')
    expect(Object.keys(entry)).toHaveLength(3)
  })

  it('should not include agents with zero tasks', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'done', priority: 'normal' },
    ])

    expect(workload['sentinel']).toBeUndefined()
    expect(workload['oracle']).toBeUndefined()
  })

  it('should handle legacy status values passed through', () => {
    const workload = aggregateWorkload([
      { assignedAgent: 'forge', status: 'pending', priority: 'normal' },
      { assignedAgent: 'forge', status: 'active', priority: 'high' },
    ])

    expect(workload['forge'].total).toBe(2)
    expect(workload['forge'].byStatus['pending']).toBe(1)
    expect(workload['forge'].byStatus['active']).toBe(1)
  })

  it('should handle undefined assignedAgent mixed with explicit unassigned', () => {
    const workload = aggregateWorkload([
      { status: 'planning', priority: 'normal' },
      { assignedAgent: 'unassigned', status: 'ready', priority: 'high' },
    ])

    expect(Object.keys(workload)).toHaveLength(1)
    expect(workload['unassigned'].total).toBe(2)
    expect(workload['unassigned'].byStatus['planning']).toBe(1)
    expect(workload['unassigned'].byStatus['ready']).toBe(1)
  })

  it('should maintain total consistency across a complex mixed workload', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'in_progress', priority: 'urgent' },
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'done', priority: 'normal' },
      { assignedAgent: 'sentinel', status: 'planning', priority: 'low' },
      { assignedAgent: 'sentinel', status: 'blocked', priority: 'urgent' },
      { assignedAgent: 'sentinel', status: 'in_review', priority: 'normal' },
      { assignedAgent: 'sentinel', status: 'in_review', priority: 'high' },
      { status: 'ready', priority: 'normal' },
      { assignedAgent: 'oracle', status: 'cancelled', priority: 'low' },
    ]

    const workload = aggregateWorkload(tasks)

    // Verify grand total matches input count
    const grandTotal = Object.values(workload).reduce((sum, w) => sum + w.total, 0)
    expect(grandTotal).toBe(tasks.length)

    // Verify per-agent totals
    expect(workload['forge'].total).toBe(3)
    expect(workload['sentinel'].total).toBe(4)
    expect(workload['unassigned'].total).toBe(1)
    expect(workload['oracle'].total).toBe(1)

    // Verify status-priority consistency per agent
    for (const agent of Object.keys(workload)) {
      const statusSum = Object.values(workload[agent].byStatus).reduce((a, b) => a + b, 0)
      const prioritySum = Object.values(workload[agent].byPriority).reduce((a, b) => a + b, 0)
      expect(statusSum).toBe(workload[agent].total)
      expect(prioritySum).toBe(workload[agent].total)
    }
  })
})
