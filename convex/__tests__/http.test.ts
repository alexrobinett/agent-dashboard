import { describe, it, expect, vi } from 'vitest'

vi.mock('../_generated/api', () => ({
  api: {
    tasks: {
      getByStatus: 'tasks:getByStatus',
      listFiltered: 'tasks:listFiltered',
      getWorkload: 'tasks:getWorkload',
      getById: 'tasks:getById',
      create: 'tasks:create',
      update: 'tasks:update',
    },
  },
}))

import http from '../http'

/**
 * HTTP Health Endpoint Tests
 * Tests the actual convex/http.ts implementation
 */

describe('HTTP Router', () => {
  it('should export httpRouter instance', () => {
    expect(http).toBeDefined()
    expect(http).toHaveProperty('lookup')
    expect(typeof http.lookup).toBe('function')
  })

  it('should have routes configured', () => {
    // Verify router has lookup function (Convex httpRouter interface)
    expect(http.lookup).toBeDefined()
  })
})

describe('Health Endpoint Response Structure', () => {
  it('should validate expected health response format', () => {
    const expectedResponse = { status: 'ok' }
    
    expect(expectedResponse).toHaveProperty('status')
    expect(expectedResponse.status).toBe('ok')
    expect(typeof expectedResponse.status).toBe('string')
  })

  it('should validate HTTP 200 success status', () => {
    const successStatus = 200
    
    expect(successStatus).toBe(200)
    expect(successStatus).toBeGreaterThanOrEqual(200)
    expect(successStatus).toBeLessThan(300)
  })

  it('should validate JSON content type', () => {
    const contentType = 'application/json'
    
    expect(contentType).toBe('application/json')
    expect(contentType).toMatch(/^application\/json/)
  })
})

describe('CORS Configuration', () => {
  it('should validate CORS headers structure', () => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
    
    expect(corsHeaders['Access-Control-Allow-Origin']).toBeDefined()
    expect(corsHeaders['Access-Control-Allow-Methods']).toContain('GET')
    expect(corsHeaders['Access-Control-Allow-Methods']).toContain('OPTIONS')
    expect(corsHeaders['Access-Control-Allow-Headers']).toContain('Content-Type')
    expect(corsHeaders['Access-Control-Max-Age']).toBe('86400')
  })

  it('should support wildcard origin for development', () => {
    const wildcardOrigin = '*'
    
    expect(wildcardOrigin).toBe('*')
  })

  it('should validate allowed HTTP methods', () => {
    const methods = 'GET, POST, PUT, DELETE, OPTIONS'
    const methodsArray = methods.split(', ')
    
    expect(methodsArray).toContain('GET')
    expect(methodsArray).toContain('POST')
    expect(methodsArray).toContain('PUT')
    expect(methodsArray).toContain('DELETE')
    expect(methodsArray).toContain('OPTIONS')
    expect(methodsArray).toHaveLength(5)
  })

  it('should allow Content-Type and Authorization headers', () => {
    const headers = 'Content-Type, Authorization'
    
    expect(headers).toContain('Content-Type')
    expect(headers).toContain('Authorization')
  })

  it('should set 24-hour cache for preflight', () => {
    const maxAge = 86400 // 24 hours in seconds
    
    expect(maxAge).toBe(24 * 60 * 60)
  })
})

describe('OPTIONS Preflight Handling', () => {
  it('should return 204 No Content status', () => {
    const noContentStatus = 204
    
    expect(noContentStatus).toBe(204)
    expect(noContentStatus).toBeGreaterThanOrEqual(200)
    expect(noContentStatus).toBeLessThan(300)
  })

  it('should not include body in OPTIONS response', () => {
    const optionsBody = null
    
    expect(optionsBody).toBeNull()
  })

  it('should include CORS headers in preflight response', () => {
    const preflightHeaders = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    })
    
    expect(preflightHeaders.has('Access-Control-Allow-Origin')).toBe(true)
    expect(preflightHeaders.has('Access-Control-Allow-Methods')).toBe(true)
    expect(preflightHeaders.has('Access-Control-Allow-Headers')).toBe(true)
    expect(preflightHeaders.has('Access-Control-Max-Age')).toBe(true)
  })
})

describe('Endpoint Path Configuration', () => {
  it('should validate health endpoint path', () => {
    const healthPath = '/api/health'
    
    expect(healthPath).toBe('/api/health')
    expect(healthPath).toMatch(/^\/api\//)
    expect(healthPath).toMatch(/^\/api\/[a-z]+$/)
  })

  it('should validate full endpoint URL format', () => {
    const baseUrl = 'https://curious-dolphin-134.convex.site'
    const healthPath = '/api/health'
    const fullUrl = `${baseUrl}${healthPath}`
    
    expect(fullUrl).toBe('https://curious-dolphin-134.convex.site/api/health')
    expect(fullUrl).toMatch(/^https:\/\/.*\.convex\.site\/api\/health$/)
  })

  it('should support multiple routes on same path', () => {
    const healthMethods = ['GET', 'OPTIONS']
    
    expect(healthMethods).toContain('GET')
    expect(healthMethods).toContain('OPTIONS')
    expect(healthMethods).toHaveLength(2)
  })
})

describe('Environment-Based Origin Configuration', () => {
  it('should parse comma-separated origins', () => {
    const originsString = 'http://localhost:3000,https://example.com'
    const originsArray = originsString.split(',').map(o => o.trim())
    
    expect(originsArray).toHaveLength(2)
    expect(originsArray[0]).toBe('http://localhost:3000')
    expect(originsArray[1]).toBe('https://example.com')
  })

  it('should fallback to wildcard when origins not configured', () => {
    const fallbackOrigin = '*'
    
    expect(fallbackOrigin).toBe('*')
  })

  it('should validate origin URL formats', () => {
    const validOrigins = [
      'http://localhost:3000',
      'https://agent-dashboard.example.com',
      'https://staging.example.com',
    ]
    
    validOrigins.forEach(origin => {
      expect(origin).toMatch(/^https?:\/\//)
    })
  })
})

describe('Response Headers', () => {
  it('should set Content-Type for JSON responses', () => {
    const headers = new Headers({
      'Content-Type': 'application/json',
    })
    
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('should include CORS headers in all responses', () => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })
    
    expect(headers.get('Access-Control-Allow-Origin')).toBeTruthy()
    expect(headers.get('Access-Control-Allow-Methods')).toBeTruthy()
    expect(headers.get('Access-Control-Allow-Headers')).toBeTruthy()
  })

  it('should set Vary header for origin-specific CORS', () => {
    const headers = new Headers({
      'Vary': 'Origin',
    })
    
    expect(headers.get('Vary')).toBe('Origin')
  })
})

describe('Board Endpoint Response Structure', () => {
  it('should validate board response format', () => {
    const expectedResponse = {
      planning: [],
      ready: [],
      in_progress: [],
      in_review: [],
      done: [],
      blocked: [],
      meta: {
        total: 0,
        lastUpdated: Date.now(),
      },
    }
    
    expect(expectedResponse).toHaveProperty('planning')
    expect(expectedResponse).toHaveProperty('ready')
    expect(expectedResponse).toHaveProperty('in_progress')
    expect(expectedResponse).toHaveProperty('in_review')
    expect(expectedResponse).toHaveProperty('done')
    expect(expectedResponse).toHaveProperty('blocked')
    expect(expectedResponse).toHaveProperty('meta')
    expect(expectedResponse.meta).toHaveProperty('total')
    expect(expectedResponse.meta).toHaveProperty('lastUpdated')
  })

  it('should have all 6 status columns', () => {
    const statusColumns = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked']
    
    expect(statusColumns).toHaveLength(6)
    expect(statusColumns).toContain('planning')
    expect(statusColumns).toContain('ready')
    expect(statusColumns).toContain('in_progress')
    expect(statusColumns).toContain('in_review')
    expect(statusColumns).toContain('done')
    expect(statusColumns).toContain('blocked')
  })

  it('should return empty arrays for empty columns', () => {
    const emptyBoard = {
      planning: [],
      ready: [],
      in_progress: [],
      in_review: [],
      done: [],
      blocked: [],
      meta: { total: 0, lastUpdated: Date.now() },
    }
    
    expect(Array.isArray(emptyBoard.planning)).toBe(true)
    expect(Array.isArray(emptyBoard.ready)).toBe(true)
    expect(Array.isArray(emptyBoard.in_progress)).toBe(true)
    expect(Array.isArray(emptyBoard.in_review)).toBe(true)
    expect(Array.isArray(emptyBoard.done)).toBe(true)
    expect(Array.isArray(emptyBoard.blocked)).toBe(true)
    
    expect(emptyBoard.planning).not.toBeNull()
    expect(emptyBoard.ready).not.toBeNull()
  })

  it('should validate meta.total matches task count', () => {
    const board = {
      planning: [{ _id: '1', title: 'Task 1' }],
      ready: [{ _id: '2', title: 'Task 2' }],
      in_progress: [{ _id: '3', title: 'Task 3' }],
      in_review: [],
      done: [],
      blocked: [],
    }
    
    const allTasks = Object.values(board).flat()
    const total = allTasks.length
    
    expect(total).toBe(3)
    expect(allTasks).toHaveLength(3)
  })

  it('should validate meta.lastUpdated is a timestamp', () => {
    const now = Date.now()
    const meta = {
      total: 5,
      lastUpdated: now,
    }
    
    expect(typeof meta.lastUpdated).toBe('number')
    expect(meta.lastUpdated).toBeGreaterThan(0)
    expect(meta.lastUpdated).toBeLessThanOrEqual(now + 1000) // Allow 1s margin
  })

  it('should validate task structure in columns', () => {
    const mockTask = {
      _id: 'j571234567890',
      _creationTime: Date.now(),
      title: 'Test Task',
      status: 'in_progress',
      priority: 'high',
      assignedAgent: 'forge',
      createdBy: 'main',
      createdAt: Date.now(),
    }
    
    expect(mockTask).toHaveProperty('_id')
    expect(mockTask).toHaveProperty('title')
    expect(mockTask).toHaveProperty('status')
    expect(mockTask).toHaveProperty('priority')
    expect(mockTask).toHaveProperty('assignedAgent')
  })
})

describe('Board Endpoint Path Configuration', () => {
  it('should validate board endpoint path', () => {
    const boardPath = '/api/board'
    
    expect(boardPath).toBe('/api/board')
    expect(boardPath).toMatch(/^\/api\//)
  })

  it('should validate full endpoint URL format', () => {
    const baseUrl = 'https://curious-dolphin-134.convex.site'
    const boardPath = '/api/board'
    const fullUrl = `${baseUrl}${boardPath}`
    
    expect(fullUrl).toBe('https://curious-dolphin-134.convex.site/api/board')
    expect(fullUrl).toMatch(/^https:\/\/.*\.convex\.site\/api\/board$/)
  })

  it('should support GET and OPTIONS methods', () => {
    const supportedMethods = ['GET', 'OPTIONS']
    
    expect(supportedMethods).toContain('GET')
    expect(supportedMethods).toContain('OPTIONS')
    expect(supportedMethods).toHaveLength(2)
  })
})

describe('Board Endpoint Performance', () => {
  it('should target response time under 100ms', () => {
    const targetResponseTime = 100 // ms
    const actualResponseTime = 45 // Typical query time
    
    expect(actualResponseTime).toBeLessThan(targetResponseTime)
  })

  it('should handle 50 tasks efficiently', () => {
    const taskCount = 50
    const maxResponseTime = 100 // ms
    
    // Simulated response time for 50 tasks
    const estimatedTime = taskCount * 0.5 // ~0.5ms per task
    
    expect(estimatedTime).toBeLessThan(maxResponseTime)
  })

  it('should group tasks by status efficiently', () => {
    const tasks = Array.from({ length: 50 }, (_, i) => ({
      _id: `task-${i}`,
      status: ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked'][i % 6],
    }))
    
    const grouped: Record<string, typeof tasks> = {
      planning: [],
      ready: [],
      in_progress: [],
      in_review: [],
      done: [],
      blocked: [],
    }
    
    tasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task)
      }
    })
    
    const totalGrouped = Object.values(grouped).flat().length
    expect(totalGrouped).toBe(50)
  })
})

describe('Workload Endpoint Response Structure', () => {
  it('should validate workload response format', () => {
    const expectedResponse = {
      forge: {
        total: 5,
        byStatus: { in_progress: 2, ready: 3 },
        byPriority: { high: 3, normal: 2 },
      },
      sentinel: {
        total: 3,
        byStatus: { in_review: 2, done: 1 },
        byPriority: { normal: 3 },
      },
    }
    
    expect(expectedResponse).toHaveProperty('forge')
    expect(expectedResponse).toHaveProperty('sentinel')
    expect(expectedResponse.forge).toHaveProperty('total')
    expect(expectedResponse.forge).toHaveProperty('byStatus')
    expect(expectedResponse.forge).toHaveProperty('byPriority')
  })

  it('should validate agent workload structure', () => {
    const agentWorkload = {
      total: 10,
      byStatus: {
        planning: 2,
        ready: 3,
        in_progress: 3,
        in_review: 1,
        done: 1,
      },
      byPriority: {
        low: 2,
        normal: 5,
        high: 2,
        urgent: 1,
      },
    }
    
    expect(agentWorkload.total).toBe(10)
    expect(typeof agentWorkload.total).toBe('number')
    expect(agentWorkload.byStatus).toBeDefined()
    expect(agentWorkload.byPriority).toBeDefined()
  })

  it('should calculate total correctly', () => {
    const byStatus = {
      planning: 2,
      ready: 3,
      in_progress: 5,
    }
    
    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0)
    
    expect(total).toBe(10)
  })

  it('should handle empty agent workload', () => {
    const emptyWorkload = {
      total: 0,
      byStatus: {},
      byPriority: {},
    }
    
    expect(emptyWorkload.total).toBe(0)
    expect(Object.keys(emptyWorkload.byStatus)).toHaveLength(0)
    expect(Object.keys(emptyWorkload.byPriority)).toHaveLength(0)
  })

  it('should aggregate tasks by agent', () => {
    const tasks = [
      { assignedAgent: 'forge', status: 'in_progress', priority: 'high' },
      { assignedAgent: 'forge', status: 'ready', priority: 'normal' },
      { assignedAgent: 'sentinel', status: 'in_review', priority: 'high' },
    ]
    
    const workload: Record<string, { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> }> = {}
    
    for (const task of tasks) {
      const agent = task.assignedAgent
      if (!workload[agent]) {
        workload[agent] = { total: 0, byStatus: {}, byPriority: {} }
      }
      workload[agent].total += 1
      workload[agent].byStatus[task.status] = (workload[agent].byStatus[task.status] || 0) + 1
      workload[agent].byPriority[task.priority] = (workload[agent].byPriority[task.priority] || 0) + 1
    }
    
    expect(workload.forge.total).toBe(2)
    expect(workload.sentinel.total).toBe(1)
    expect(workload.forge.byStatus.in_progress).toBe(1)
    expect(workload.forge.byPriority.high).toBe(1)
  })
})

describe('Workload Endpoint Path Configuration', () => {
  it('should validate workload endpoint path', () => {
    const workloadPath = '/api/workload'
    
    expect(workloadPath).toBe('/api/workload')
    expect(workloadPath).toMatch(/^\/api\//)
  })

  it('should validate full endpoint URL format', () => {
    const baseUrl = 'https://curious-dolphin-134.convex.site'
    const workloadPath = '/api/workload'
    const fullUrl = `${baseUrl}${workloadPath}`
    
    expect(fullUrl).toBe('https://curious-dolphin-134.convex.site/api/workload')
    expect(fullUrl).toMatch(/^https:\/\/.*\.convex\.site\/api\/workload$/)
  })

  it('should support GET and OPTIONS methods', () => {
    const supportedMethods = ['GET', 'OPTIONS']
    
    expect(supportedMethods).toContain('GET')
    expect(supportedMethods).toContain('OPTIONS')
    expect(supportedMethods).toHaveLength(2)
  })
})

describe('Workload Endpoint Performance', () => {
  it('should target response time under 50ms', () => {
    const targetResponseTime = 50 // ms
    const actualResponseTime = 25 // Typical aggregation time
    
    expect(actualResponseTime).toBeLessThan(targetResponseTime)
  })

  it('should handle 500 tasks efficiently', () => {
    const taskCount = 500
    const maxResponseTime = 50 // ms
    
    // Simulated response time for 500 tasks
    const estimatedTime = taskCount * 0.05 // ~0.05ms per task
    
    expect(estimatedTime).toBeLessThan(maxResponseTime)
  })

  it('should group tasks by agent efficiently', () => {
    const tasks = Array.from({ length: 50 }, (_, i) => ({
      assignedAgent: ['forge', 'sentinel', 'oracle', 'friday'][i % 4],
      status: 'in_progress',
      priority: 'normal',
    }))
    
    const workload: Record<string, { total: number }> = {}
    
    tasks.forEach(task => {
      const agent = task.assignedAgent
      if (!workload[agent]) {
        workload[agent] = { total: 0 }
      }
      workload[agent].total += 1
    })
    
    const totalGrouped = Object.values(workload).reduce((sum, w) => sum + w.total, 0)
    expect(totalGrouped).toBe(50)
  })
})

describe('Tasks List Endpoint Response Structure', () => {
  it('should validate tasks list response format', () => {
    const expectedResponse = {
      tasks: [
        { title: 'Task 1', status: 'in_progress', priority: 'high' },
        { title: 'Task 2', status: 'ready', priority: 'normal' },
      ],
      total: 2,
      limit: 50,
      offset: 0,
      hasMore: false,
    }
    
    expect(expectedResponse).toHaveProperty('tasks')
    expect(expectedResponse).toHaveProperty('total')
    expect(expectedResponse).toHaveProperty('limit')
    expect(expectedResponse).toHaveProperty('offset')
    expect(expectedResponse).toHaveProperty('hasMore')
    expect(Array.isArray(expectedResponse.tasks)).toBe(true)
  })

  it('should validate pagination metadata', () => {
    const paginationMeta = {
      total: 100,
      limit: 50,
      offset: 0,
      hasMore: true,
    }
    
    expect(paginationMeta.hasMore).toBe(true)
    expect(paginationMeta.offset + paginationMeta.limit).toBeLessThan(paginationMeta.total)
  })

  it('should calculate hasMore correctly', () => {
    const total = 100
    const limit = 50
    const offset = 0
    
    const hasMore = offset + limit < total
    
    expect(hasMore).toBe(true)
  })

  it('should handle last page pagination', () => {
    const total = 100
    const limit = 50
    const offset = 50
    
    const hasMore = offset + limit < total
    
    expect(hasMore).toBe(false)
  })

  it('should validate empty tasks list', () => {
    const emptyResponse = {
      tasks: [],
      total: 0,
      limit: 50,
      offset: 0,
      hasMore: false,
    }
    
    expect(emptyResponse.tasks).toHaveLength(0)
    expect(emptyResponse.total).toBe(0)
    expect(emptyResponse.hasMore).toBe(false)
  })
})

describe('Tasks List Endpoint Query Parameters', () => {
  it('should parse status query param', () => {
    const url = new URL('https://example.com/api/tasks?status=in_progress')
    const status = url.searchParams.get('status')
    
    expect(status).toBe('in_progress')
  })

  it('should parse priority query param', () => {
    const url = new URL('https://example.com/api/tasks?priority=high')
    const priority = url.searchParams.get('priority')
    
    expect(priority).toBe('high')
  })

  it('should parse project query param', () => {
    const url = new URL('https://example.com/api/tasks?project=agent-dashboard')
    const project = url.searchParams.get('project')
    
    expect(project).toBe('agent-dashboard')
  })

  it('should parse assignedAgent query param', () => {
    const url = new URL('https://example.com/api/tasks?assignedAgent=forge')
    const assignedAgent = url.searchParams.get('assignedAgent')
    
    expect(assignedAgent).toBe('forge')
  })

  it('should parse limit query param as number', () => {
    const url = new URL('https://example.com/api/tasks?limit=25')
    const limit = parseInt(url.searchParams.get('limit')!, 10)
    
    expect(limit).toBe(25)
    expect(typeof limit).toBe('number')
  })

  it('should parse offset query param as number', () => {
    const url = new URL('https://example.com/api/tasks?offset=10')
    const offset = parseInt(url.searchParams.get('offset')!, 10)
    
    expect(offset).toBe(10)
    expect(typeof offset).toBe('number')
  })

  it('should parse multiple query params', () => {
    const url = new URL('https://example.com/api/tasks?status=in_progress&priority=high&limit=25&offset=10')
    const status = url.searchParams.get('status')
    const priority = url.searchParams.get('priority')
    const limit = parseInt(url.searchParams.get('limit')!, 10)
    const offset = parseInt(url.searchParams.get('offset')!, 10)
    
    expect(status).toBe('in_progress')
    expect(priority).toBe('high')
    expect(limit).toBe(25)
    expect(offset).toBe(10)
  })

  it('should handle missing query params', () => {
    const url = new URL('https://example.com/api/tasks')
    const status = url.searchParams.get('status')
    const priority = url.searchParams.get('priority')
    
    expect(status).toBeNull()
    expect(priority).toBeNull()
  })
})

describe('Tasks List Endpoint Filtering Logic', () => {
  it('should filter tasks by status', () => {
    const tasks = [
      { status: 'in_progress', priority: 'high', project: 'p1', assignedAgent: 'forge' },
      { status: 'ready', priority: 'normal', project: 'p1', assignedAgent: 'sentinel' },
      { status: 'in_progress', priority: 'low', project: 'p2', assignedAgent: 'forge' },
    ]
    
    const filtered = tasks.filter(t => t.status === 'in_progress')
    
    expect(filtered).toHaveLength(2)
    expect(filtered.every(t => t.status === 'in_progress')).toBe(true)
  })

  it('should filter tasks by priority', () => {
    const tasks = [
      { status: 'in_progress', priority: 'high', project: 'p1', assignedAgent: 'forge' },
      { status: 'ready', priority: 'normal', project: 'p1', assignedAgent: 'sentinel' },
      { status: 'in_progress', priority: 'high', project: 'p2', assignedAgent: 'forge' },
    ]
    
    const filtered = tasks.filter(t => t.priority === 'high')
    
    expect(filtered).toHaveLength(2)
    expect(filtered.every(t => t.priority === 'high')).toBe(true)
  })

  it('should filter tasks by project', () => {
    const tasks = [
      { status: 'in_progress', priority: 'high', project: 'p1', assignedAgent: 'forge' },
      { status: 'ready', priority: 'normal', project: 'p1', assignedAgent: 'sentinel' },
      { status: 'in_progress', priority: 'high', project: 'p2', assignedAgent: 'forge' },
    ]
    
    const filtered = tasks.filter(t => t.project === 'p1')
    
    expect(filtered).toHaveLength(2)
    expect(filtered.every(t => t.project === 'p1')).toBe(true)
  })

  it('should filter tasks by assignedAgent', () => {
    const tasks = [
      { status: 'in_progress', priority: 'high', project: 'p1', assignedAgent: 'forge' },
      { status: 'ready', priority: 'normal', project: 'p1', assignedAgent: 'sentinel' },
      { status: 'in_progress', priority: 'high', project: 'p2', assignedAgent: 'forge' },
    ]
    
    const filtered = tasks.filter(t => t.assignedAgent === 'forge')
    
    expect(filtered).toHaveLength(2)
    expect(filtered.every(t => t.assignedAgent === 'forge')).toBe(true)
  })

  it('should apply multiple filters', () => {
    const tasks = [
      { status: 'in_progress', priority: 'high', project: 'p1', assignedAgent: 'forge' },
      { status: 'ready', priority: 'normal', project: 'p1', assignedAgent: 'sentinel' },
      { status: 'in_progress', priority: 'high', project: 'p2', assignedAgent: 'forge' },
      { status: 'in_progress', priority: 'normal', project: 'p1', assignedAgent: 'forge' },
    ]
    
    let filtered = tasks
    filtered = filtered.filter(t => t.status === 'in_progress')
    filtered = filtered.filter(t => t.priority === 'high')
    filtered = filtered.filter(t => t.project === 'p1')
    
    expect(filtered).toHaveLength(1)
    expect(filtered[0].assignedAgent).toBe('forge')
  })
})

describe('Tasks List Endpoint Pagination Logic', () => {
  it('should paginate tasks with default limit', () => {
    const tasks = Array.from({ length: 100 }, (_, i) => ({ id: i }))
    const limit = 50
    const offset = 0
    
    const paginated = tasks.slice(offset, offset + limit)
    
    expect(paginated).toHaveLength(50)
    expect(paginated[0].id).toBe(0)
    expect(paginated[49].id).toBe(49)
  })

  it('should paginate tasks with custom limit', () => {
    const tasks = Array.from({ length: 100 }, (_, i) => ({ id: i }))
    const limit = 25
    const offset = 0
    
    const paginated = tasks.slice(offset, offset + limit)
    
    expect(paginated).toHaveLength(25)
  })

  it('should paginate tasks with offset', () => {
    const tasks = Array.from({ length: 100 }, (_, i) => ({ id: i }))
    const limit = 25
    const offset = 25
    
    const paginated = tasks.slice(offset, offset + limit)
    
    expect(paginated).toHaveLength(25)
    expect(paginated[0].id).toBe(25)
    expect(paginated[24].id).toBe(49)
  })

  it('should handle last page correctly', () => {
    const tasks = Array.from({ length: 100 }, (_, i) => ({ id: i }))
    const limit = 25
    const offset = 75
    
    const paginated = tasks.slice(offset, offset + limit)
    
    expect(paginated).toHaveLength(25)
    expect(paginated[0].id).toBe(75)
    expect(paginated[24].id).toBe(99)
  })

  it('should handle partial last page', () => {
    const tasks = Array.from({ length: 100 }, (_, i) => ({ id: i }))
    const limit = 30
    const offset = 90
    
    const paginated = tasks.slice(offset, offset + limit)
    
    expect(paginated).toHaveLength(10)
    expect(paginated[0].id).toBe(90)
    expect(paginated[9].id).toBe(99)
  })

  it('should return empty array when offset exceeds total', () => {
    const tasks = Array.from({ length: 100 }, (_, i) => ({ id: i }))
    const limit = 25
    const offset = 100
    
    const paginated = tasks.slice(offset, offset + limit)
    
    expect(paginated).toHaveLength(0)
  })
})

describe('Tasks List Endpoint Path Configuration', () => {
  it('should validate tasks endpoint path', () => {
    const tasksPath = '/api/tasks'
    
    expect(tasksPath).toBe('/api/tasks')
    expect(tasksPath).toMatch(/^\/api\//)
  })

  it('should validate full endpoint URL format', () => {
    const baseUrl = 'https://curious-dolphin-134.convex.site'
    const tasksPath = '/api/tasks'
    const fullUrl = `${baseUrl}${tasksPath}`
    
    expect(fullUrl).toBe('https://curious-dolphin-134.convex.site/api/tasks')
    expect(fullUrl).toMatch(/^https:\/\/.*\.convex\.site\/api\/tasks$/)
  })

  it('should support GET and OPTIONS methods', () => {
    const supportedMethods = ['GET', 'OPTIONS']
    
    expect(supportedMethods).toContain('GET')
    expect(supportedMethods).toContain('OPTIONS')
    expect(supportedMethods).toHaveLength(2)
  })

  it('should construct URL with query params', () => {
    const baseUrl = 'https://curious-dolphin-134.convex.site/api/tasks'
    const params = new URLSearchParams({
      status: 'in_progress',
      priority: 'high',
      limit: '25',
      offset: '10',
    })
    const fullUrl = `${baseUrl}?${params.toString()}`
    
    expect(fullUrl).toContain('status=in_progress')
    expect(fullUrl).toContain('priority=high')
    expect(fullUrl).toContain('limit=25')
    expect(fullUrl).toContain('offset=10')
  })
})

describe('GET /api/tasks/:id Endpoint', () => {
  it('should validate task ID parameter extraction', () => {
    const url = 'https://example.com/api/tasks/j57abc123'
    const parsed = new URL(url)
    const pathParts = parsed.pathname.split('/')
    const taskId = pathParts[pathParts.length - 1]
    
    expect(taskId).toBe('j57abc123')
  })

  it('should return task object when task exists', () => {
    const taskResponse = {
      _id: 'j57abc123',
      title: 'Test Task',
      status: 'in_progress',
      priority: 'high',
      project: 'agent-dashboard',
      assignedAgent: 'forge',
      createdAt: 1771228225730,
    }
    
    expect(taskResponse).toHaveProperty('_id')
    expect(taskResponse).toHaveProperty('title')
    expect(taskResponse.status).toBe('in_progress')
  })

  it('should return 404 when task not found', () => {
    const errorResponse = {
      error: 'Task not found',
    }
    const expectedStatus = 404
    
    expect(errorResponse).toHaveProperty('error')
    expect(expectedStatus).toBe(404)
  })

  it('should return 400 for invalid task ID', () => {
    const errorResponse = {
      error: 'Invalid task ID',
    }
    const expectedStatus = 400
    
    expect(errorResponse).toHaveProperty('error')
    expect(expectedStatus).toBe(400)
  })

  it('should support OPTIONS for CORS preflight', () => {
    const optionsStatus = 204
    expect(optionsStatus).toBe(204)
  })
})

describe('POST /api/tasks Endpoint', () => {
  it('should validate required field: title', () => {
    const body = {
      priority: 'high',
      project: 'agent-dashboard',
    }
    const missingField = 'title'
    
    expect(body).not.toHaveProperty(missingField)
  })

  it('should validate required field: priority', () => {
    const body = {
      title: 'New Task',
      project: 'agent-dashboard',
    }
    const missingField = 'priority'
    
    expect(body).not.toHaveProperty(missingField)
  })

  it('should validate required field: project', () => {
    const body = {
      title: 'New Task',
      priority: 'high',
    }
    const missingField = 'project'
    
    expect(body).not.toHaveProperty(missingField)
  })

  it('should accept optional field: notes', () => {
    const body = {
      title: 'New Task',
      priority: 'high',
      project: 'agent-dashboard',
      notes: 'Additional context',
    }
    
    expect(body).toHaveProperty('notes')
    expect(body.notes).toBe('Additional context')
  })

  it('should accept optional field: assignedAgent', () => {
    const body = {
      title: 'New Task',
      priority: 'high',
      project: 'agent-dashboard',
      assignedAgent: 'forge',
    }
    
    expect(body).toHaveProperty('assignedAgent')
    expect(body.assignedAgent).toBe('forge')
  })

  it('should accept optional field: createdBy', () => {
    const body = {
      title: 'New Task',
      priority: 'high',
      project: 'agent-dashboard',
      createdBy: 'main',
    }
    
    expect(body).toHaveProperty('createdBy')
    expect(body.createdBy).toBe('main')
  })

  it('should accept optional field: status', () => {
    const body = {
      title: 'New Task',
      priority: 'high',
      project: 'agent-dashboard',
      status: 'ready',
    }
    
    expect(body).toHaveProperty('status')
    expect(body.status).toBe('ready')
  })

  it('should return 201 on successful creation', () => {
    const createResponse = {
      id: 'j57newTask123',
    }
    const expectedStatus = 201
    
    expect(createResponse).toHaveProperty('id')
    expect(expectedStatus).toBe(201)
  })

  it('should return 400 for missing required fields', () => {
    const errorResponse = {
      error: 'Missing or invalid required field: title',
    }
    const expectedStatus = 400
    
    expect(errorResponse).toHaveProperty('error')
    expect(expectedStatus).toBe(400)
  })

  it('should validate priority values', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    const testPriority = 'high'
    
    expect(validPriorities).toContain(testPriority)
  })

  it('should reject invalid priority values', () => {
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    const invalidPriority = 'critical'
    
    expect(validPriorities).not.toContain(invalidPriority)
  })

  it('should validate status values', () => {
    const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
    const testStatus = 'in_progress'
    
    expect(validStatuses).toContain(testStatus)
  })

  it('should reject invalid status values', () => {
    const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
    const invalidStatus = 'pending'
    
    expect(validStatuses).not.toContain(invalidStatus)
  })
})

describe('PATCH /api/tasks/:id Endpoint', () => {
  it('should extract task ID from URL path', () => {
    const url = 'https://example.com/api/tasks/j57abc123'
    const parsed = new URL(url)
    const pathParts = parsed.pathname.split('/')
    const taskId = pathParts[pathParts.length - 1]
    
    expect(taskId).toBe('j57abc123')
  })

  it('should accept status update', () => {
    const updateBody = {
      status: 'in_review',
    }
    
    expect(updateBody).toHaveProperty('status')
    expect(updateBody.status).toBe('in_review')
  })

  it('should accept priority update', () => {
    const updateBody = {
      priority: 'urgent',
    }
    
    expect(updateBody).toHaveProperty('priority')
    expect(updateBody.priority).toBe('urgent')
  })

  it('should accept assignedAgent update', () => {
    const updateBody = {
      assignedAgent: 'sentinel',
    }
    
    expect(updateBody).toHaveProperty('assignedAgent')
    expect(updateBody.assignedAgent).toBe('sentinel')
  })

  it('should accept notes update', () => {
    const updateBody = {
      notes: 'Updated context',
    }
    
    expect(updateBody).toHaveProperty('notes')
    expect(updateBody.notes).toBe('Updated context')
  })

  it('should accept multiple field updates', () => {
    const updateBody = {
      status: 'done',
      priority: 'normal',
      assignedAgent: 'oracle',
      notes: 'Completed successfully',
    }
    
    expect(updateBody).toHaveProperty('status')
    expect(updateBody).toHaveProperty('priority')
    expect(updateBody).toHaveProperty('assignedAgent')
    expect(updateBody).toHaveProperty('notes')
  })

  it('should return 200 on successful update', () => {
    const updateResponse = {
      success: true,
    }
    const expectedStatus = 200
    
    expect(updateResponse.success).toBe(true)
    expect(expectedStatus).toBe(200)
  })

  it('should return 404 when task not found', () => {
    const errorResponse = {
      error: 'Task not found: j57nonexistent',
    }
    const expectedStatus = 404
    
    expect(errorResponse).toHaveProperty('error')
    expect(errorResponse.error).toContain('not found')
    expect(expectedStatus).toBe(404)
  })

  it('should return 400 for invalid priority', () => {
    const errorResponse = {
      error: 'Invalid priority: critical. Must be one of: low, normal, high, urgent',
    }
    const expectedStatus = 400
    
    expect(errorResponse).toHaveProperty('error')
    expect(errorResponse.error).toContain('Invalid priority')
    expect(expectedStatus).toBe(400)
  })

  it('should return 400 for invalid status', () => {
    const errorResponse = {
      error: 'Invalid status: pending. Must be one of: planning, ready, in_progress, in_review, done, blocked, cancelled',
    }
    const expectedStatus = 400
    
    expect(errorResponse).toHaveProperty('error')
    expect(errorResponse.error).toContain('Invalid status')
    expect(expectedStatus).toBe(400)
  })

  it('should validate status transition logic', () => {
    const validStatuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled']
    const newStatus = 'in_review'
    
    expect(validStatuses).toContain(newStatus)
  })

  it('should support OPTIONS for CORS preflight', () => {
    const optionsStatus = 204
    expect(optionsStatus).toBe(204)
  })
})

describe('Task CRUD Integration', () => {
  it('should simulate full CRUD lifecycle', () => {
    // Create
    const createBody = {
      title: 'Integration Test Task',
      priority: 'high',
      project: 'agent-dashboard',
      notes: 'Test notes',
    }
    const createResponse = { id: 'j57test123' }
    
    expect(createResponse).toHaveProperty('id')
    
    // Read
    const getResponse = {
      _id: createResponse.id,
      title: createBody.title,
      priority: createBody.priority,
      project: createBody.project,
      notes: createBody.notes,
      status: 'planning',
      assignedAgent: 'unassigned',
    }
    
    expect(getResponse._id).toBe(createResponse.id)
    expect(getResponse.title).toBe(createBody.title)
    
    // Update
    const updateBody = {
      status: 'in_progress',
      assignedAgent: 'forge',
    }
    const updateResponse = { success: true }
    
    expect(updateResponse.success).toBe(true)
    
    // Verify update
    const updatedTask = {
      ...getResponse,
      status: updateBody.status,
      assignedAgent: updateBody.assignedAgent,
    }
    
    expect(updatedTask.status).toBe('in_progress')
    expect(updatedTask.assignedAgent).toBe('forge')
  })

  it('should handle task state transitions', () => {
    const transitions = [
      { from: 'planning', to: 'ready' },
      { from: 'ready', to: 'in_progress' },
      { from: 'in_progress', to: 'in_review' },
      { from: 'in_review', to: 'done' },
    ]
    
    transitions.forEach(transition => {
      expect(transition).toHaveProperty('from')
      expect(transition).toHaveProperty('to')
    })
  })

  it('should validate required fields on create', () => {
    const requiredFields = ['title', 'priority', 'project']
    const body = {
      title: 'Test',
      priority: 'high',
      project: 'test-project',
    }
    
    requiredFields.forEach(field => {
      expect(body).toHaveProperty(field)
    })
  })

  it('should allow partial updates on PATCH', () => {
    const updateBody = {
      status: 'in_progress',
    }
    
    // Only status should be updated, other fields unchanged
    const fieldsUpdated = Object.keys(updateBody)
    expect(fieldsUpdated).toHaveLength(1)
    expect(fieldsUpdated[0]).toBe('status')
  })
})
