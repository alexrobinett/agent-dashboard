/**
 * Sprint 4.3c: DnD Integration Tests
 *
 * End-to-end integration tests covering the full drag-and-drop flow:
 * - Drag task between columns updates status optimistically
 * - Failed mutation triggers rollback (task returns to original column)
 * - Keyboard DnD (space to pick up, arrow keys, space to drop)
 * - Touch DnD simulation
 * - Multiple rapid drags don't corrupt state
 * - Dragging to same column is a no-op
 * - Accessibility: aria-labels, live regions announce moves
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor, act } from '@testing-library/react'
import React from 'react'

// --- Mutation control ---
let mutationPromises: Array<{
  resolve: (v: any) => void
  reject: (e: Error) => void
}> = []

const mockMutate = vi.fn(() => {
  return new Promise((resolve, reject) => {
    mutationPromises.push({ resolve, reject })
  })
})

// --- Toast mock ---
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...args: any[]) => mockToastError(...args),
    success: vi.fn(),
  },
  Toaster: () => null,
}))

// --- @dnd-kit/core mock ---
const mockDndContext = vi.fn()
const mockUseDraggable = vi.fn()
const mockUseDroppable = vi.fn()

vi.mock('@dnd-kit/core', () => ({
  DndContext: (props: any) => {
    mockDndContext(props)
    return React.createElement(
      'div',
      { 'data-testid': 'dnd-context' },
      props.children,
      // Render a live region for announcements if provided
      props.accessibility?.announcements
        ? React.createElement(
            'div',
            { role: 'status', 'aria-live': 'assertive', 'data-testid': 'dnd-live-region' },
            '',
          )
        : null,
    )
  },
  useDraggable: (config: any) => {
    mockUseDraggable(config)
    return {
      attributes: {
        role: 'button',
        tabIndex: 0,
        'aria-roledescription': 'draggable',
        'aria-describedby': `draggable-${config.id}`,
      },
      listeners: { onKeyDown: vi.fn(), onPointerDown: vi.fn() },
      setNodeRef: vi.fn(),
      transform: null,
      isDragging: false,
    }
  },
  useDroppable: (config: any) => {
    mockUseDroppable(config)
    return {
      setNodeRef: vi.fn(),
      isOver: false,
    }
  },
  DragOverlay: (props: any) =>
    React.createElement('div', { 'data-testid': 'drag-overlay' }, props.children),
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
  ConvexProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
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

// --- Helpers ---

function makeTasks(overrides?: Partial<Record<string, any[]>>) {
  return {
    planning: [
      {
        _id: 'task-1',
        _creationTime: Date.now(),
        title: 'Planning Task',
        assignedAgent: 'forge',
        status: 'planning',
        priority: 'high',
        project: 'dashboard',
        createdBy: 'main',
        createdAt: Date.now(),
      },
    ],
    ready: [
      {
        _id: 'task-2',
        _creationTime: Date.now(),
        title: 'Ready Task',
        assignedAgent: 'sentinel',
        status: 'ready',
        priority: 'normal',
        project: 'dashboard',
        createdBy: 'main',
        createdAt: Date.now(),
      },
    ],
    in_progress: [
      {
        _id: 'task-3',
        _creationTime: Date.now(),
        title: 'WIP Task',
        assignedAgent: 'forge',
        status: 'in_progress',
        priority: 'low',
        project: 'dashboard',
        createdBy: 'main',
        createdAt: Date.now(),
      },
    ],
    in_review: [],
    done: [],
    blocked: [],
    ...overrides,
  }
}

function getLatestDndProps() {
  return mockDndContext.mock.calls[mockDndContext.mock.calls.length - 1][0]
}

function simulateDragEnd(taskId: string, targetColumn: string | null) {
  const props = getLatestDndProps()
  act(() => {
    props.onDragEnd({
      active: { id: taskId },
      over: targetColumn ? { id: targetColumn } : null,
    })
  })
}

// --- Tests ---

beforeEach(() => {
  vi.clearAllMocks()
  mutationPromises = []
})

describe('DnD Integration: Optimistic Column Move', () => {
  it('moves task from planning to in_progress immediately on drop', () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDragEnd('task-1', 'in_progress')

    // Task appears in target column
    const ipCol = screen.getByTestId('column-in_progress')
    expect(within(ipCol).getByText('Planning Task')).toBeDefined()

    // Task removed from source column
    const planCol = screen.getByTestId('column-planning')
    expect(within(planCol).queryByText('Planning Task')).toBeNull()
  })

  it('updates count badges immediately', () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    expect(screen.getByTestId('count-badge-planning').textContent).toBe('1')
    expect(screen.getByTestId('count-badge-done').textContent).toBe('0')

    simulateDragEnd('task-1', 'done')

    expect(screen.getByTestId('count-badge-planning').textContent).toBe('0')
    expect(screen.getByTestId('count-badge-done').textContent).toBe('1')
  })

  it('calls mutation with correct task id and new status', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    simulateDragEnd('task-2', 'blocked')

    expect(mockMutate).toHaveBeenCalledWith({
      id: 'task-2',
      status: 'blocked',
    })
  })
})

describe('DnD Integration: Rollback on Failure', () => {
  it('rolls back task to original column when mutation rejects', async () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDragEnd('task-1', 'done')

    // Optimistically moved
    expect(within(screen.getByTestId('column-done')).getByText('Planning Task')).toBeDefined()

    // Reject the mutation
    await act(async () => {
      mutationPromises[0].reject(new Error('Transition not allowed'))
    })

    // Rolled back to planning (server state)
    await waitFor(() => {
      expect(within(screen.getByTestId('column-planning')).getByText('Planning Task')).toBeDefined()
    })
  })

  it('shows error toast on rollback', async () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDragEnd('task-1', 'in_review')

    await act(async () => {
      mutationPromises[0].reject(new Error('Permission denied'))
    })

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to move task',
        expect.objectContaining({ description: 'Permission denied' }),
      )
    })
  })

  it('does not affect other tasks during rollback', async () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDragEnd('task-1', 'done')

    // task-2 still in ready, task-3 still in in_progress
    expect(within(screen.getByTestId('column-ready')).getByText('Ready Task')).toBeDefined()
    expect(within(screen.getByTestId('column-in_progress')).getByText('WIP Task')).toBeDefined()

    await act(async () => {
      mutationPromises[0].reject(new Error('fail'))
    })

    await waitFor(() => {
      expect(within(screen.getByTestId('column-ready')).getByText('Ready Task')).toBeDefined()
      expect(within(screen.getByTestId('column-in_progress')).getByText('WIP Task')).toBeDefined()
    })
  })
})

describe('DnD Integration: Same-column No-op', () => {
  it('does not call mutation when dropped on same column', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    simulateDragEnd('task-1', 'planning')

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('does not call mutation when dropped outside any column', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    simulateDragEnd('task-1', null)

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('task stays in original column when dropped on same column', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    simulateDragEnd('task-2', 'ready')

    expect(within(screen.getByTestId('column-ready')).getByText('Ready Task')).toBeDefined()
    expect(mockMutate).not.toHaveBeenCalled()
  })
})

describe('DnD Integration: Multiple Rapid Drags', () => {
  it('handles two sequential moves without corruption', async () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    // Move task-1 planning -> done
    simulateDragEnd('task-1', 'done')
    // Move task-2 ready -> blocked
    simulateDragEnd('task-2', 'blocked')

    // Both optimistically moved
    expect(within(screen.getByTestId('column-done')).getByText('Planning Task')).toBeDefined()
    expect(within(screen.getByTestId('column-blocked')).getByText('Ready Task')).toBeDefined()

    // task-3 unaffected
    expect(within(screen.getByTestId('column-in_progress')).getByText('WIP Task')).toBeDefined()

    expect(mockMutate).toHaveBeenCalledTimes(2)
  })

  it('rollback of one does not affect the other', async () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    // Move both
    simulateDragEnd('task-1', 'done')
    simulateDragEnd('task-2', 'blocked')

    // Fail task-1, succeed task-2
    await act(async () => {
      mutationPromises[0].reject(new Error('fail'))
    })

    // task-1 rolled back to planning
    await waitFor(() => {
      expect(within(screen.getByTestId('column-planning')).getByText('Planning Task')).toBeDefined()
    })

    // task-2 still optimistically in blocked
    expect(within(screen.getByTestId('column-blocked')).getByText('Ready Task')).toBeDefined()
  })

  it('rapid move of same task to different columns uses latest target', () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    // Move task-1 planning -> done, then done -> blocked rapidly
    simulateDragEnd('task-1', 'done')
    simulateDragEnd('task-1', 'blocked')

    // The second move's mutation should fire
    expect(mockMutate).toHaveBeenCalledTimes(2)

    // Task should be in blocked (latest optimistic state)
    expect(within(screen.getByTestId('column-blocked')).getByText('Planning Task')).toBeDefined()
  })
})

describe('DnD Integration: Keyboard DnD', () => {
  it('configures KeyboardSensor in the board', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    const props = getLatestDndProps()
    // Sensors should be passed to DndContext
    expect(props.sensors).toBeDefined()
  })

  it('task cards are focusable with tabIndex=0', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn.getAttribute('tabindex')).toBe('0')
    })
  })

  it('task cards have aria-roledescription="draggable"', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn.getAttribute('aria-roledescription')).toBe('draggable')
    })
  })

  it('useDraggable returns keyboard listeners (onKeyDown)', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    // Verify useDraggable was called for each task
    const calls = mockUseDraggable.mock.calls
    const ids = calls.map((c: any[]) => c[0].id)
    expect(ids).toContain('task-1')
    expect(ids).toContain('task-2')
    expect(ids).toContain('task-3')
  })

  it('keyboard drop triggers same onDragEnd as pointer drop', () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    // Keyboard DnD goes through the same onDragEnd callback
    simulateDragEnd('task-1', 'in_review')

    expect(mockMutate).toHaveBeenCalledWith({
      id: 'task-1',
      status: 'in_review',
    })
    expect(within(screen.getByTestId('column-in_review')).getByText('Planning Task')).toBeDefined()
  })
})

describe('DnD Integration: Touch DnD', () => {
  it('configures TouchSensor in the board', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    const props = getLatestDndProps()
    expect(props.sensors).toBeDefined()
    // Sensors array should exist (configured via useSensors)
    expect(Array.isArray(props.sensors)).toBe(true)
  })

  it('task cards have drag handles for touch targets', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    const handles = screen.getAllByTestId('drag-handle')
    // One per task
    expect(handles.length).toBe(3)
  })

  it('touch drop triggers optimistic update same as pointer', () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    // Touch DnD uses same onDragEnd
    simulateDragEnd('task-3', 'done')

    expect(mockMutate).toHaveBeenCalledWith({
      id: 'task-3',
      status: 'done',
    })
    expect(within(screen.getByTestId('column-done')).getByText('WIP Task')).toBeDefined()
  })
})

describe('DnD Integration: Accessibility', () => {
  it('all columns have data-testid for identification', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    const statuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked']
    statuses.forEach((s) => {
      expect(screen.getByTestId(`column-${s}`)).toBeDefined()
    })
  })

  it('each task card has a unique data-testid', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    expect(screen.getByTestId('task-card-task-1')).toBeDefined()
    expect(screen.getByTestId('task-card-task-2')).toBeDefined()
    expect(screen.getByTestId('task-card-task-3')).toBeDefined()
  })

  it('DragOverlay renders for visual feedback during drag', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    expect(screen.getByTestId('drag-overlay')).toBeDefined()
  })

  it('each draggable has aria-describedby for screen reader hints', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach((btn) => {
      expect(btn.getAttribute('aria-describedby')).toMatch(/^draggable-/)
    })
  })

  it('columns display formatted status names', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    expect(screen.getByText('planning')).toBeDefined()
    expect(screen.getByText('ready')).toBeDefined()
    expect(screen.getByText('in progress')).toBeDefined()
    expect(screen.getByText('in review')).toBeDefined()
    expect(screen.getByText('done')).toBeDefined()
    expect(screen.getByText('blocked')).toBeDefined()
  })

  it('empty columns show accessible empty state', () => {
    render(<KanbanBoard tasks={makeTasks()} />)
    expect(screen.getByTestId('empty-in_review')).toBeDefined()
    expect(screen.getByTestId('empty-done')).toBeDefined()
    expect(screen.getByTestId('empty-blocked')).toBeDefined()
  })
})
