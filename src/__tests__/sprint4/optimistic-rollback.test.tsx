/**
 * Sprint 4.3b: Optimistic Status Mutation + Rollback Tests
 *
 * Tests the KanbanBoard's optimistic update behavior:
 * - Immediate UI update on drag-drop (before server responds)
 * - Rollback to original position on mutation failure
 * - Toast notification on rollback
 * - Concurrent move handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor, act } from '@testing-library/react'
import React from 'react'

// Track mutation calls and control resolution
let mockMutateResolve: (value: any) => void
let mockMutateReject: (error: Error) => void
const mockMutate = vi.fn(() => {
  return new Promise((resolve, reject) => {
    mockMutateResolve = resolve
    mockMutateReject = reject
  })
})

// Track toast calls
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...args: any[]) => mockToastError(...args),
    success: vi.fn(),
  },
  Toaster: () => null,
}))

// Mock @dnd-kit/core
const mockDndContext = vi.fn()
vi.mock('@dnd-kit/core', () => ({
  DndContext: (props: any) => {
    mockDndContext(props)
    return React.createElement('div', { 'data-testid': 'dnd-context' }, props.children)
  },
  useDraggable: (config: any) => ({
    attributes: { role: 'button', tabIndex: 0, 'aria-roledescription': 'draggable', 'aria-describedby': `draggable-${config.id}` },
    listeners: { onKeyDown: vi.fn(), onPointerDown: vi.fn() },
    setNodeRef: vi.fn(),
    transform: null,
    isDragging: false,
  }),
  useDroppable: (_config: any) => ({
    setNodeRef: vi.fn(),
    isOver: false,
  }),
  DragOverlay: (props: any) => React.createElement('div', { 'data-testid': 'drag-overlay' }, props.children),
  KeyboardSensor: 'KeyboardSensor',
  PointerSensor: 'PointerSensor',
  TouchSensor: 'TouchSensor',
  useSensor: (...args: any[]) => args[0],
  useSensors: (...args: any[]) => args,
  closestCorners: vi.fn(),
}))

vi.mock('convex/react', () => ({
  useMutation: () => mockMutate,
  useQuery: () => null,
  ConvexProvider: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    tasks: {
      update: 'tasks:update',
      getByStatus: 'tasks:getByStatus',
      getWorkload: 'tasks:getWorkload',
    },
  },
}))

import { KanbanBoard } from '../../components/KanbanBoard'

const mockTasks = {
  planning: [
    {
      _id: 'task-1',
      title: 'Planning Task',
      assignedAgent: 'forge',
      status: 'planning',
      priority: 'high',
      project: 'test',
    },
  ],
  ready: [
    {
      _id: 'task-2',
      title: 'Ready Task',
      assignedAgent: 'sentinel',
      status: 'ready',
      priority: 'normal',
      project: 'test',
    },
  ],
  in_progress: [],
  in_review: [],
  done: [],
  blocked: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

function simulateDrop(taskId: string, targetColumn: string) {
  const dndContextProps = mockDndContext.mock.calls[mockDndContext.mock.calls.length - 1][0]
  act(() => {
    dndContextProps.onDragEnd({
      active: { id: taskId },
      over: { id: targetColumn },
    })
  })
}

describe('Optimistic Status Mutation', () => {
  it('should immediately move task card to new column on drop (before server responds)', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    // Verify initial state
    const planningCol = screen.getByTestId('column-planning')
    expect(within(planningCol).getByText('Planning Task')).toBeDefined()

    // Simulate drop — mutation is still pending (not resolved)
    simulateDrop('task-1', 'in_progress')

    // Task should immediately appear in in_progress column
    const inProgressCol = screen.getByTestId('column-in_progress')
    expect(within(inProgressCol).getByText('Planning Task')).toBeDefined()

    // Task should no longer be in planning column
    const updatedPlanningCol = screen.getByTestId('column-planning')
    expect(within(updatedPlanningCol).queryByText('Planning Task')).toBeNull()
  })

  it('should call mutation with correct arguments', () => {
    render(<KanbanBoard tasks={mockTasks} />)
    simulateDrop('task-1', 'done')

    expect(mockMutate).toHaveBeenCalledWith({
      id: 'task-1',
      status: 'done',
    })
  })

  it('should update column counts immediately', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    // Initial: planning has 1 task
    expect(screen.getByTestId('count-badge-planning').textContent).toBe('1')
    expect(screen.getByTestId('count-badge-in_progress').textContent).toBe('0')

    simulateDrop('task-1', 'in_progress')

    // After optimistic update: planning has 0, in_progress has 1
    expect(screen.getByTestId('count-badge-planning').textContent).toBe('0')
    expect(screen.getByTestId('count-badge-in_progress').textContent).toBe('1')
  })
})

describe('Rollback on Mutation Failure', () => {
  it('should roll back task to original column when mutation fails', async () => {
    render(<KanbanBoard tasks={mockTasks} />)

    simulateDrop('task-1', 'in_progress')

    // Optimistically moved
    expect(within(screen.getByTestId('column-in_progress')).getByText('Planning Task')).toBeDefined()

    // Simulate mutation failure
    await act(async () => {
      mockMutateReject(new Error('Invalid status transition'))
    })

    // Should roll back — task back in planning (server state restored)
    await waitFor(() => {
      const planningCol = screen.getByTestId('column-planning')
      expect(within(planningCol).getByText('Planning Task')).toBeDefined()
    })
  })

  it('should show toast notification on rollback', async () => {
    render(<KanbanBoard tasks={mockTasks} />)

    simulateDrop('task-1', 'in_progress')

    await act(async () => {
      mockMutateReject(new Error('Server error: invalid transition'))
    })

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to move task',
        expect.objectContaining({
          description: 'Server error: invalid transition',
        }),
      )
    })
  })

  it('should show toast with generic message for non-Error failures', async () => {
    // Override mockMutate for this test to reject with a string
    mockMutate.mockImplementationOnce(() => Promise.reject('network timeout'))

    render(<KanbanBoard tasks={mockTasks} />)
    simulateDrop('task-1', 'blocked')

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to move task',
        expect.objectContaining({
          description: 'Unknown error',
        }),
      )
    })
  })

  it('should not affect other tasks during rollback', async () => {
    render(<KanbanBoard tasks={mockTasks} />)

    simulateDrop('task-1', 'in_progress')

    // task-2 should still be in ready
    expect(within(screen.getByTestId('column-ready')).getByText('Ready Task')).toBeDefined()

    await act(async () => {
      mockMutateReject(new Error('fail'))
    })

    // task-2 still in ready after rollback
    await waitFor(() => {
      expect(within(screen.getByTestId('column-ready')).getByText('Ready Task')).toBeDefined()
    })
  })
})

describe('Successful Mutation', () => {
  it('should clean up pending state after successful mutation (falls back to server state)', async () => {
    render(<KanbanBoard tasks={mockTasks} />)

    simulateDrop('task-1', 'done')

    // Optimistically in done
    expect(within(screen.getByTestId('column-done')).getByText('Planning Task')).toBeDefined()

    // Resolve the mutation — pending override cleared, server state takes over
    // In real app, Convex subscription would already have updated serverTasks
    await act(async () => {
      mockMutateResolve({ success: true })
    })

    // After pending cleared, task goes back to server position (planning)
    // This is expected — the Convex subscription hasn't updated yet in this test
    // In production, Convex reactivity updates the tasks prop before the pending clears
    const planningCol = screen.getByTestId('column-planning')
    expect(within(planningCol).getByText('Planning Task')).toBeDefined()

    // No toast should have been called (success path)
    expect(mockToastError).not.toHaveBeenCalled()
  })
})

describe('Edge Cases', () => {
  it('should not call mutation when dropped on same column', () => {
    render(<KanbanBoard tasks={mockTasks} />)
    simulateDrop('task-1', 'planning')

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('should not call mutation when dropped outside any column', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    const dndContextProps = mockDndContext.mock.calls[mockDndContext.mock.calls.length - 1][0]
    act(() => {
      dndContextProps.onDragEnd({
        active: { id: 'task-1' },
        over: null,
      })
    })

    expect(mockMutate).not.toHaveBeenCalled()
  })
})
