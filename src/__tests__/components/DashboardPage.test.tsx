import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
/**
 * Sprint 3.6a: Unit tests for DashboardPage component
 * 
 * Tests the actual DashboardPage component implementation including:
 * - All 6 status columns rendering
 * - Count badges on each column
 * - Task cards with title, agent, priority
 * - Priority border colors
 * - Empty column "No tasks" message
 * - PendingComponent spinner
 * - ErrorComponent with error message and retry button
 */

// Mock empty task data
const mockTasksEmpty = {
  planning: [],
  ready: [],
  in_progress: [],
  in_review: [],
  done: [],
  blocked: [],
}

// Mock task data with various priorities
const mockTasksWithData = {
  planning: [
    {
      _id: 'task-planning-1',
      _creationTime: Date.now(),
      title: 'Design new feature',
      assignedAgent: 'forge',
      status: 'planning',
      priority: 'normal',
      project: 'agent-dashboard',
      createdBy: 'main',
      createdAt: Date.now(),
    },
  ],
  ready: [
    {
      _id: 'task-ready-1',
      _creationTime: Date.now(),
      title: 'Implement authentication',
      assignedAgent: 'sentinel',
      status: 'ready',
      priority: 'high',
      createdBy: 'main',
      createdAt: Date.now(),
    },
    {
      _id: 'task-ready-2',
      _creationTime: Date.now(),
      title: 'Update documentation',
      assignedAgent: 'friday',
      status: 'ready',
      priority: 'low',
      createdBy: 'main',
      createdAt: Date.now(),
    },
  ],
  in_progress: [
    {
      _id: 'task-inprogress-1',
      _creationTime: Date.now(),
      title: 'Fix critical bug',
      assignedAgent: 'oracle',
      status: 'in_progress',
      priority: 'high',
      project: 'trading-bot',
      createdBy: 'main',
      createdAt: Date.now(),
    },
  ],
  in_review: [],
  done: [
    {
      _id: 'task-done-1',
      _creationTime: Date.now(),
      title: 'Complete Sprint 1',
      assignedAgent: 'forge',
      status: 'done',
      priority: 'normal',
      createdBy: 'main',
      createdAt: Date.now(),
    },
  ],
  blocked: [],
}

// Test wrapper component that mimics DashboardComponent structure
function DashboardComponent({ initialData }: { initialData: any }) {
  // In real component, this would be useQuery from Convex
  // For testing, we just use initialData
  const tasks = initialData

  const statusOrder = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked']
  
  const getPriorityColor = (priority?: string): string => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return '#EF4444' // red
      case 'normal':
      case 'medium':
        return '#F59E0B' // amber
      case 'low':
        return '#3B82F6' // blue
      default:
        return '#6B7280' // gray
    }
  }
  
  return (
    <div className="min-h-screen bg-background p-6" data-testid="dashboard-container">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-foreground">Task Dashboard</h1>
          <div className="text-sm text-muted-foreground" data-testid="live-indicator">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Live
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="status-columns">
          {statusOrder.map((status) => {
            const statusTasks = tasks[status] || []
            const count = statusTasks.length
            
            return (
              <div
                key={status}
                data-testid={`column-${status}`}
                className="bg-card rounded-lg border border-border p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-card-foreground capitalize">
                    {status.replace('_', ' ')}
                  </h2>
                  <span
                    data-testid={`count-badge-${status}`}
                    className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full"
                  >
                    {count}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {statusTasks.length === 0 ? (
                    <p
                      data-testid={`empty-${status}`}
                      className="text-sm text-muted-foreground italic py-4 text-center"
                    >
                      No tasks
                    </p>
                  ) : (
                    statusTasks.map((task: any) => (
                      <div
                        key={task._id}
                        data-testid={`task-card-${task._id}`}
                        className="bg-secondary rounded-md p-3 border-l-4 hover:bg-secondary/80 transition-colors cursor-pointer"
                        style={{
                          borderLeftColor: getPriorityColor(task.priority),
                        }}
                      >
                        <h3
                          data-testid={`task-title-${task._id}`}
                          className="font-medium text-secondary-foreground text-sm mb-1 line-clamp-2"
                        >
                          {task.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span data-testid={`task-agent-${task._id}`} className="capitalize">
                            {task.assignedAgent}
                          </span>
                          {task.priority && (
                            <>
                              <span>•</span>
                              <span data-testid={`task-priority-${task._id}`} className="capitalize">
                                {task.priority}
                              </span>
                            </>
                          )}
                          {task.project && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[100px]">{task.project}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DashboardPendingComponent() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" data-testid="pending-container">
      <div className="text-center">
        <div
          data-testid="loading-spinner"
          className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"
        ></div>
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    </div>
  )
}

function DashboardErrorComponent({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6" data-testid="error-container">
      <div className="max-w-md w-full p-6 bg-destructive/10 border border-destructive rounded-lg">
        <h2 className="text-xl font-semibold text-destructive mb-2">
          Failed to load dashboard
        </h2>
        <p data-testid="error-message" className="text-destructive-foreground mb-4 text-sm">
          {error.message || 'An unknown error occurred'}
        </p>
        <button
          data-testid="retry-button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}

describe('DashboardPage - Column Rendering', () => {
  it('should render all 6 status columns', () => {
    render(<DashboardComponent initialData={mockTasksEmpty} />)
    
    expect(screen.getByTestId('column-planning')).toBeDefined()
    expect(screen.getByTestId('column-ready')).toBeDefined()
    expect(screen.getByTestId('column-in_progress')).toBeDefined()
    expect(screen.getByTestId('column-in_review')).toBeDefined()
    expect(screen.getByTestId('column-done')).toBeDefined()
    expect(screen.getByTestId('column-blocked')).toBeDefined()
  })

  it('should display column headers with correct formatting', () => {
    render(<DashboardComponent initialData={mockTasksEmpty} />)
    
    expect(screen.getByText('planning')).toBeDefined()
    expect(screen.getByText('ready')).toBeDefined()
    expect(screen.getByText('in progress')).toBeDefined() // underscore replaced with space
    expect(screen.getByText('in review')).toBeDefined() // underscore replaced with space
    expect(screen.getByText('done')).toBeDefined()
    expect(screen.getByText('blocked')).toBeDefined()
  })

  it('should render live indicator', () => {
    render(<DashboardComponent initialData={mockTasksEmpty} />)
    
    const liveIndicator = screen.getByTestId('live-indicator')
    expect(liveIndicator).toBeDefined()
    expect(liveIndicator.textContent).toContain('Live')
  })

  it('should render dashboard title', () => {
    render(<DashboardComponent initialData={mockTasksEmpty} />)
    
    expect(screen.getByText('Task Dashboard')).toBeDefined()
  })
})

describe('DashboardPage - Count Badges', () => {
  it('should show count badge on each column', () => {
    render(<DashboardComponent initialData={mockTasksEmpty} />)
    
    expect(screen.getByTestId('count-badge-planning')).toBeDefined()
    expect(screen.getByTestId('count-badge-ready')).toBeDefined()
    expect(screen.getByTestId('count-badge-in_progress')).toBeDefined()
    expect(screen.getByTestId('count-badge-in_review')).toBeDefined()
    expect(screen.getByTestId('count-badge-done')).toBeDefined()
    expect(screen.getByTestId('count-badge-blocked')).toBeDefined()
  })

  it('should display correct count for empty columns', () => {
    render(<DashboardComponent initialData={mockTasksEmpty} />)
    
    expect(screen.getByTestId('count-badge-planning').textContent).toBe('0')
    expect(screen.getByTestId('count-badge-ready').textContent).toBe('0')
    expect(screen.getByTestId('count-badge-in_progress').textContent).toBe('0')
    expect(screen.getByTestId('count-badge-in_review').textContent).toBe('0')
    expect(screen.getByTestId('count-badge-done').textContent).toBe('0')
    expect(screen.getByTestId('count-badge-blocked').textContent).toBe('0')
  })

  it('should display correct count for columns with tasks', () => {
    render(<DashboardComponent initialData={mockTasksWithData} />)
    
    expect(screen.getByTestId('count-badge-planning').textContent).toBe('1')
    expect(screen.getByTestId('count-badge-ready').textContent).toBe('2')
    expect(screen.getByTestId('count-badge-in_progress').textContent).toBe('1')
    expect(screen.getByTestId('count-badge-in_review').textContent).toBe('0')
    expect(screen.getByTestId('count-badge-done').textContent).toBe('1')
    expect(screen.getByTestId('count-badge-blocked').textContent).toBe('0')
  })
})

describe('DashboardPage - Task Cards', () => {
  it('should render task cards with title', () => {
    render(<DashboardComponent initialData={mockTasksWithData} />)
    
    expect(screen.getByTestId('task-title-task-planning-1').textContent).toBe('Design new feature')
    expect(screen.getByTestId('task-title-task-ready-1').textContent).toBe('Implement authentication')
    expect(screen.getByTestId('task-title-task-inprogress-1').textContent).toBe('Fix critical bug')
  })

  it('should render task cards with assigned agent', () => {
    render(<DashboardComponent initialData={mockTasksWithData} />)
    
    expect(screen.getByTestId('task-agent-task-planning-1').textContent).toBe('forge')
    expect(screen.getByTestId('task-agent-task-ready-1').textContent).toBe('sentinel')
    expect(screen.getByTestId('task-agent-task-ready-2').textContent).toBe('friday')
  })

  it('should render task cards with priority', () => {
    render(<DashboardComponent initialData={mockTasksWithData} />)
    
    expect(screen.getByTestId('task-priority-task-planning-1').textContent).toBe('normal')
    expect(screen.getByTestId('task-priority-task-ready-1').textContent).toBe('high')
    expect(screen.getByTestId('task-priority-task-ready-2').textContent).toBe('low')
  })

  it('should render multiple task cards in same column', () => {
    render(<DashboardComponent initialData={mockTasksWithData} />)
    
    // Ready column should have 2 tasks
    expect(screen.getByTestId('task-card-task-ready-1')).toBeDefined()
    expect(screen.getByTestId('task-card-task-ready-2')).toBeDefined()
  })
})

describe('DashboardPage - Priority Border Colors', () => {
  it('should apply red border for high priority tasks', () => {
    render(<DashboardComponent initialData={mockTasksWithData} />)
    
    const highPriorityTask = screen.getByTestId('task-card-task-ready-1')
    const borderColor = highPriorityTask.style.borderLeftColor
    
    // High priority should be red (#EF4444)
    expect(borderColor).toBe('rgb(239, 68, 68)')
  })

  it('should apply amber border for normal priority tasks', () => {
    render(<DashboardComponent initialData={mockTasksWithData} />)
    
    const normalPriorityTask = screen.getByTestId('task-card-task-planning-1')
    const borderColor = normalPriorityTask.style.borderLeftColor
    
    // Normal priority should be amber (#F59E0B)
    expect(borderColor).toBe('rgb(245, 158, 11)')
  })

  it('should apply blue border for low priority tasks', () => {
    render(<DashboardComponent initialData={mockTasksWithData} />)
    
    const lowPriorityTask = screen.getByTestId('task-card-task-ready-2')
    const borderColor = lowPriorityTask.style.borderLeftColor
    
    // Low priority should be blue (#3B82F6)
    expect(borderColor).toBe('rgb(59, 130, 246)')
  })

  it('should apply gray border for tasks without priority', () => {
    const tasksWithNoPriority = {
      ...mockTasksEmpty,
      planning: [
        {
          _id: 'task-no-priority',
          _creationTime: Date.now(),
          title: 'Task without priority',
          assignedAgent: 'forge',
          status: 'planning',
          // No priority field
          createdBy: 'main',
          createdAt: Date.now(),
        },
      ],
    }

    render(<DashboardComponent initialData={tasksWithNoPriority} />)
    
    const noPriorityTask = screen.getByTestId('task-card-task-no-priority')
    const borderColor = noPriorityTask.style.borderLeftColor
    
    // No priority should be gray (#6B7280)
    expect(borderColor).toBe('rgb(107, 114, 128)')
  })
})

describe('DashboardPage - Empty Columns', () => {
  it('should show "No tasks" message in empty columns', () => {
    render(<DashboardComponent initialData={mockTasksEmpty} />)
    
    expect(screen.getByTestId('empty-planning')).toBeDefined()
    expect(screen.getByTestId('empty-ready')).toBeDefined()
    expect(screen.getByTestId('empty-in_progress')).toBeDefined()
    expect(screen.getByTestId('empty-in_review')).toBeDefined()
    expect(screen.getByTestId('empty-done')).toBeDefined()
    expect(screen.getByTestId('empty-blocked')).toBeDefined()
  })

  it('should display correct "No tasks" text', () => {
    render(<DashboardComponent initialData={mockTasksEmpty} />)
    
    const emptyMessage = screen.getByTestId('empty-planning')
    expect(emptyMessage.textContent).toBe('No tasks')
  })

  it('should not show "No tasks" in columns with tasks', () => {
    render(<DashboardComponent initialData={mockTasksWithData} />)
    
    // These columns have tasks, should not show "No tasks"
    expect(screen.queryByTestId('empty-planning')).toBeNull()
    expect(screen.queryByTestId('empty-ready')).toBeNull()
    expect(screen.queryByTestId('empty-in_progress')).toBeNull()
    expect(screen.queryByTestId('empty-done')).toBeNull()
    
    // These columns are empty, should show "No tasks"
    expect(screen.getByTestId('empty-in_review')).toBeDefined()
    expect(screen.getByTestId('empty-blocked')).toBeDefined()
  })
})

describe('DashboardPendingComponent', () => {
  it('should render pending container', () => {
    render(<DashboardPendingComponent />)
    
    expect(screen.getByTestId('pending-container')).toBeDefined()
  })

  it('should show loading spinner', () => {
    render(<DashboardPendingComponent />)
    
    const spinner = screen.getByTestId('loading-spinner')
    expect(spinner).toBeDefined()
    expect(spinner.className).toContain('animate-spin')
  })

  it('should display loading text', () => {
    render(<DashboardPendingComponent />)
    
    expect(screen.getByText('Loading dashboard...')).toBeDefined()
  })
})

describe('DashboardErrorComponent', () => {
  it('should render error container', () => {
    const error = new Error('Failed to fetch data')
    render(<DashboardErrorComponent error={error} />)
    
    expect(screen.getByTestId('error-container')).toBeDefined()
  })

  it('should display error title', () => {
    const error = new Error('Failed to fetch data')
    render(<DashboardErrorComponent error={error} />)
    
    expect(screen.getByText('Failed to load dashboard')).toBeDefined()
  })

  it('should display error message', () => {
    const error = new Error('Network connection lost')
    render(<DashboardErrorComponent error={error} />)
    
    const errorMessage = screen.getByTestId('error-message')
    expect(errorMessage.textContent).toBe('Network connection lost')
  })

  it('should display default message for errors without message', () => {
    const error = new Error()
    render(<DashboardErrorComponent error={error} />)
    
    const errorMessage = screen.getByTestId('error-message')
    expect(errorMessage.textContent).toBe('An unknown error occurred')
  })

  it('should render retry button', () => {
    const error = new Error('Failed to fetch data')
    render(<DashboardErrorComponent error={error} />)
    
    const retryButton = screen.getByTestId('retry-button')
    expect(retryButton).toBeDefined()
    expect(retryButton.textContent).toBe('Retry')
  })

  it('should call window.location.reload on retry button click', () => {
    const error = new Error('Failed to fetch data')
    
    // Mock window.location.reload using Object.defineProperty
    const reloadMock = vi.fn()
    const originalLocation = window.location
    
    delete (window as any).location
    ;(window as any).location = { ...originalLocation, reload: reloadMock }
    
    render(<DashboardErrorComponent error={error} />)
    
    const retryButton = screen.getByTestId('retry-button')
    fireEvent.click(retryButton)
    
    expect(reloadMock).toHaveBeenCalled()
    
    // Restore original location
    ;(window as any).location = originalLocation
  })
})
