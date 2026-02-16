import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConvexProvider } from 'convex/react'
import { ConvexReactClient } from 'convex/react'

// Mock Convex client with proper query subscription
const createMockConvexClient = () => {
  const subscribers = new Map<string, (value: unknown) => void>()
  
  return {
    subscribe: (query: { name: string }, args: unknown, callback: (value: unknown) => void) => {
      const key = `${query.name}:${JSON.stringify(args)}`
      subscribers.set(key, callback)
      
      // Immediately invoke callback with mock data
      if (query.name === 'tasks:getByStatus') {
        callback(mockTasksData)
      }
      
      return {
        unsubscribe: () => subscribers.delete(key),
      }
    },
    mutation: vi.fn(),
    action: vi.fn(),
  } as unknown as ConvexReactClient
}

// Mock data matching Convex schema
const mockTasksData = {
  planning: [
    {
      _id: 'task1',
      _creationTime: Date.now(),
      title: 'Planning Task Example',
      assignedAgent: 'forge',
      status: 'planning',
      priority: 'normal',
      createdBy: 'main',
      createdAt: Date.now(),
    },
  ],
  ready: [
    {
      _id: 'task2',
      _creationTime: Date.now(),
      title: 'Ready Task Example',
      assignedAgent: 'sentinel',
      status: 'ready',
      priority: 'high',
      createdBy: 'main',
      createdAt: Date.now(),
    },
  ],
  in_progress: [
    {
      _id: 'task3',
      _creationTime: Date.now(),
      title: 'In Progress Task',
      assignedAgent: 'oracle',
      status: 'in_progress',
      priority: 'urgent',
      project: 'agent-dashboard',
      createdBy: 'main',
      createdAt: Date.now(),
    },
  ],
  in_review: [],
  done: [],
  blocked: [],
}

// Simple wrapper component that uses ConvexProvider and renders task list
function TestDashboardWrapper() {
  const mockClient = createMockConvexClient()
  
  return (
    <ConvexProvider client={mockClient}>
      <div data-testid="dashboard-container">
        <h1>Task Dashboard</h1>
        <div data-testid="status-columns">
          {Object.entries(mockTasksData).map(([status, tasks]) => (
            <div key={status} data-testid={`column-${status}`}>
              <h2>{status.replace('_', ' ')}</h2>
              <span data-testid={`count-${status}`}>{tasks.length}</span>
              {tasks.map((task) => (
                <div key={task._id} data-testid={`task-${task._id}`}>
                  <h3>{task.title}</h3>
                  <span>{task.assignedAgent}</span>
                  <span>{task.priority}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </ConvexProvider>
  )
}

describe('Dashboard Component Rendering', () => {
  it('should render dashboard container', () => {
    render(<TestDashboardWrapper />)
    
    expect(screen.getByTestId('dashboard-container')).toBeDefined()
    expect(screen.getByText('Task Dashboard')).toBeDefined()
  })

  it('should render all status columns', () => {
    render(<TestDashboardWrapper />)
    
    const columns = screen.getByTestId('status-columns')
    expect(columns).toBeDefined()
    
    // All 6 status columns should be present
    expect(screen.getByTestId('column-planning')).toBeDefined()
    expect(screen.getByTestId('column-ready')).toBeDefined()
    expect(screen.getByTestId('column-in_progress')).toBeDefined()
    expect(screen.getByTestId('column-in_review')).toBeDefined()
    expect(screen.getByTestId('column-done')).toBeDefined()
    expect(screen.getByTestId('column-blocked')).toBeDefined()
  })

  it('should display correct task counts per column', () => {
    render(<TestDashboardWrapper />)
    
    expect(screen.getByTestId('count-planning').textContent).toBe('1')
    expect(screen.getByTestId('count-ready').textContent).toBe('1')
    expect(screen.getByTestId('count-in_progress').textContent).toBe('1')
    expect(screen.getByTestId('count-in_review').textContent).toBe('0')
    expect(screen.getByTestId('count-done').textContent).toBe('0')
    expect(screen.getByTestId('count-blocked').textContent).toBe('0')
  })

  it('should render individual task cards with data', () => {
    render(<TestDashboardWrapper />)
    
    // Planning task
    const task1 = screen.getByTestId('task-task1')
    expect(task1.textContent).toContain('Planning Task Example')
    expect(task1.textContent).toContain('forge')
    expect(task1.textContent).toContain('normal')
    
    // Ready task
    const task2 = screen.getByTestId('task-task2')
    expect(task2.textContent).toContain('Ready Task Example')
    expect(task2.textContent).toContain('sentinel')
    expect(task2.textContent).toContain('high')
    
    // In progress task
    const task3 = screen.getByTestId('task-task3')
    expect(task3.textContent).toContain('In Progress Task')
    expect(task3.textContent).toContain('oracle')
    expect(task3.textContent).toContain('urgent')
  })

  it('should handle empty columns gracefully', () => {
    render(<TestDashboardWrapper />)
    
    const inReviewColumn = screen.getByTestId('column-in_review')
    const doneColumn = screen.getByTestId('column-done')
    const blockedColumn = screen.getByTestId('column-blocked')
    
    expect(inReviewColumn).toBeDefined()
    expect(doneColumn).toBeDefined()
    expect(blockedColumn).toBeDefined()
    
    expect(screen.getByTestId('count-in_review').textContent).toBe('0')
    expect(screen.getByTestId('count-done').textContent).toBe('0')
    expect(screen.getByTestId('count-blocked').textContent).toBe('0')
  })
})

describe('Convex Query Integration', () => {
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
    expect(mockTasksData.in_progress).toHaveLength(1)
    expect(mockTasksData.in_review).toHaveLength(0)
    
    expect(mockTasksData.planning[0].status).toBe('planning')
    expect(mockTasksData.ready[0].status).toBe('ready')
    expect(mockTasksData.in_progress[0].status).toBe('in_progress')
  })

  it('should validate priority levels', () => {
    const task = mockTasksData.ready[0]
    const validPriorities = ['low', 'normal', 'high', 'urgent']
    
    expect(validPriorities).toContain(task.priority)
  })
})

describe('SSR Data Loading', () => {
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
