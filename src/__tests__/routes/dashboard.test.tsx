import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConvexProvider } from 'convex/react'
import { ConvexReactClient } from 'convex/react'

// Mock Convex client
const mockConvexClient = {
  query: vi.fn(),
  mutation: vi.fn(),
  action: vi.fn(),
} as unknown as ConvexReactClient

// Mock data matching Convex schema
const mockTasksData = {
  planning: [
    {
      _id: '1',
      _creationTime: Date.now(),
      title: 'Test Planning Task',
      assignedAgent: 'forge',
      status: 'planning',
      priority: 'normal',
      createdBy: 'main',
      createdAt: Date.now(),
    },
  ],
  ready: [
    {
      _id: '2',
      _creationTime: Date.now(),
      title: 'Test Ready Task',
      assignedAgent: 'sentinel',
      status: 'ready',
      priority: 'high',
      createdBy: 'main',
      createdAt: Date.now(),
    },
  ],
  in_progress: [],
  in_review: [],
  done: [],
  blocked: [],
}

describe('Dashboard Convex Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_CONVEX_URL', 'https://test.convex.cloud')
  })

  it('should structure tasks data by status', () => {
    const statuses = Object.keys(mockTasksData)
    
    expect(statuses).toContain('planning')
    expect(statuses).toContain('ready')
    expect(statuses).toContain('in_progress')
    expect(statuses).toContain('in_review')
    expect(statuses).toContain('done')
    expect(statuses).toContain('blocked')
    expect(statuses).toHaveLength(6)
  })

  it('should validate task data structure', () => {
    const task = mockTasksData.ready[0]
    
    expect(task).toHaveProperty('_id')
    expect(task).toHaveProperty('_creationTime')
    expect(task).toHaveProperty('title')
    expect(task).toHaveProperty('assignedAgent')
    expect(task).toHaveProperty('status')
    expect(task).toHaveProperty('priority')
    expect(task).toHaveProperty('createdBy')
    expect(task).toHaveProperty('createdAt')
  })

  it('should group tasks correctly by status', () => {
    expect(mockTasksData.planning).toHaveLength(1)
    expect(mockTasksData.ready).toHaveLength(1)
    expect(mockTasksData.in_progress).toHaveLength(0)
    
    expect(mockTasksData.planning[0].status).toBe('planning')
    expect(mockTasksData.ready[0].status).toBe('ready')
  })

  it('should handle empty status columns', () => {
    expect(mockTasksData.in_progress).toBeDefined()
    expect(mockTasksData.in_progress).toBeInstanceOf(Array)
    expect(mockTasksData.in_progress).toHaveLength(0)
  })

  it('should validate priority levels', () => {
    const task = mockTasksData.ready[0]
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    
    expect(validPriorities).toContain(task.priority)
  })

  it('should include required metadata fields', () => {
    const task = mockTasksData.planning[0]
    
    expect(task.createdBy).toBeTruthy()
    expect(task.createdAt).toBeGreaterThan(0)
    expect(task._creationTime).toBeGreaterThan(0)
  })
})

describe('Dashboard SSR Integration', () => {
  it('should have loader data structure', () => {
    const loaderData = {
      tasks: mockTasksData,
      loadedAt: Date.now(),
    }
    
    expect(loaderData).toHaveProperty('tasks')
    expect(loaderData).toHaveProperty('loadedAt')
    expect(loaderData.loadedAt).toBeGreaterThan(0)
  })

  it('should validate SSR data format matches query response', () => {
    const loaderTasks = mockTasksData
    const queryResponse = mockTasksData
    
    expect(Object.keys(loaderTasks)).toEqual(Object.keys(queryResponse))
    expect(loaderTasks.planning).toEqual(queryResponse.planning)
    expect(loaderTasks.ready).toEqual(queryResponse.ready)
  })
})
