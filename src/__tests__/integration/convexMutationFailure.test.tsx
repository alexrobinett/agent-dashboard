/**
 * Integration tests: Convex mutation failure and optimistic rollback
 *
 * Tests the UI-level behavior when Convex mutations fail mid-flow:
 *   - Network error → optimistic update is rolled back to previous column
 *   - Validation error → task returns to original column
 *   - Error toast is shown with the error message
 *   - Multiple in-flight mutations: failure of one doesn't corrupt others
 *   - computeDisplayTasks correctly reflects pending + server state
 *
 * Uses the same mock patterns as the existing sprint4 integration tests
 * (dnd-integration.test.tsx, optimistic-rollback.test.tsx).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, waitFor, act } from '@testing-library/react'
import React from 'react'

// ── Mutation control ──────────────────────────────────────────────────────────
// We keep an array of pending promise handles so tests can resolve/reject
// individual mutations independently.
let pendingMutations: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = []

const mockMutate = vi.fn(() => {
  return new Promise((resolve, reject) => {
    pendingMutations.push({ resolve, reject })
  })
})

// ── Toast mock ────────────────────────────────────────────────────────────────
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...args: any[]) => mockToastError(...args),
    success: vi.fn(),
  },
  Toaster: () => null,
}))

// ── @dnd-kit/core mock ────────────────────────────────────────────────────────
const mockDndContext = vi.fn()
const mockUseDraggable = vi.fn()
const mockUseDroppable = vi.fn()

vi.mock('@dnd-kit/core', () => ({
  DndContext: (props: any) => {
    mockDndContext(props)
    return React.createElement('div', { 'data-testid': 'dnd-context' }, props.children)
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
    return { setNodeRef: vi.fn(), isOver: false }
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

// ── Fixture factory ───────────────────────────────────────────────────────────

function makeTasks(overrides?: Partial<Record<string, any[]>>) {
  return {
    planning: [
      {
        _id: 'task-a',
        _creationTime: Date.now(),
        title: 'Alpha Task',
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
        _id: 'task-b',
        _creationTime: Date.now(),
        title: 'Beta Task',
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
        _id: 'task-c',
        _creationTime: Date.now(),
        title: 'Gamma Task',
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

// ── DnD simulation helpers ────────────────────────────────────────────────────

function latestDndProps() {
  return mockDndContext.mock.calls[mockDndContext.mock.calls.length - 1][0]
}

function simulateDrop(taskId: string, targetColumn: string | null) {
  act(() => {
    latestDndProps().onDragEnd({
      active: { id: taskId },
      over: targetColumn ? { id: targetColumn } : null,
    })
  })
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  pendingMutations = []
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Network error during move → rollback', () => {
  it('rolls back task to original column on network error', async () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDrop('task-a', 'in_progress')

    // Optimistically moved to in_progress
    expect(within(screen.getByTestId('column-in_progress')).getByText('Alpha Task')).toBeDefined()

    // Simulate network failure
    await act(async () => {
      pendingMutations[0].reject(new Error('Network error: connection refused'))
    })

    // Rolled back to planning
    await waitFor(() => {
      expect(within(screen.getByTestId('column-planning')).getByText('Alpha Task')).toBeDefined()
    })
  })

  it('shows error toast with the network error message on rollback', async () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDrop('task-a', 'done')

    await act(async () => {
      pendingMutations[0].reject(new Error('Network error: connection refused'))
    })

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to move task',
        expect.objectContaining({ description: 'Network error: connection refused' }),
      )
    })
  })

  it('task disappears from target column after network rollback', async () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDrop('task-a', 'done')

    // Optimistically in done
    expect(within(screen.getByTestId('column-done')).getByText('Alpha Task')).toBeDefined()

    await act(async () => {
      pendingMutations[0].reject(new Error('timeout'))
    })

    await waitFor(() => {
      expect(within(screen.getByTestId('column-done')).queryByText('Alpha Task')).toBeNull()
    })
  })
})

describe('Validation error during move → rollback', () => {
  it('rolls back task when validation error is returned from Convex', async () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDrop('task-b', 'done')

    // Optimistically moved
    expect(within(screen.getByTestId('column-done')).getByText('Beta Task')).toBeDefined()

    await act(async () => {
      pendingMutations[0].reject(new Error('Invalid status transition: ready → done'))
    })

    await waitFor(() => {
      expect(within(screen.getByTestId('column-ready')).getByText('Beta Task')).toBeDefined()
    })
  })

  it('shows validation error in toast description', async () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDrop('task-b', 'planning')

    await act(async () => {
      pendingMutations[0].reject(new Error('Invalid status: planning'))
    })

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to move task',
        expect.objectContaining({ description: 'Invalid status: planning' }),
      )
    })
  })

  it('shows generic "Unknown error" toast when rejection is not an Error instance', async () => {
    mockMutate.mockImplementationOnce(() => Promise.reject('string-rejection'))

    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDrop('task-a', 'done')

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Failed to move task',
        expect.objectContaining({ description: 'Unknown error' }),
      )
    })
  })
})

describe('Optimistic update state integrity', () => {
  it('unrelated tasks remain in their columns during a rollback', async () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDrop('task-a', 'done')

    // task-b in ready and task-c in in_progress should be unaffected
    expect(within(screen.getByTestId('column-ready')).getByText('Beta Task')).toBeDefined()
    expect(within(screen.getByTestId('column-in_progress')).getByText('Gamma Task')).toBeDefined()

    await act(async () => {
      pendingMutations[0].reject(new Error('fail'))
    })

    await waitFor(() => {
      expect(within(screen.getByTestId('column-ready')).getByText('Beta Task')).toBeDefined()
      expect(within(screen.getByTestId('column-in_progress')).getByText('Gamma Task')).toBeDefined()
    })
  })

  it('column count badges restore to original after rollback', async () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    expect(screen.getByTestId('count-badge-planning').textContent).toBe('1')
    expect(screen.getByTestId('count-badge-done').textContent).toBe('0')

    simulateDrop('task-a', 'done')

    expect(screen.getByTestId('count-badge-planning').textContent).toBe('0')
    expect(screen.getByTestId('count-badge-done').textContent).toBe('1')

    await act(async () => {
      pendingMutations[0].reject(new Error('fail'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('count-badge-planning').textContent).toBe('1')
      expect(screen.getByTestId('count-badge-done').textContent).toBe('0')
    })
  })
})

describe('Multiple concurrent moves with mixed success/failure', () => {
  it('rolling back one move does not affect another pending move', async () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDrop('task-a', 'done')      // mutation[0]
    simulateDrop('task-b', 'blocked')   // mutation[1]

    // Both optimistically moved
    expect(within(screen.getByTestId('column-done')).getByText('Alpha Task')).toBeDefined()
    expect(within(screen.getByTestId('column-blocked')).getByText('Beta Task')).toBeDefined()

    // Fail the first, succeed the second
    await act(async () => {
      pendingMutations[0].reject(new Error('fail task-a'))
    })

    // task-a rolled back, task-b still optimistically in blocked
    await waitFor(() => {
      expect(within(screen.getByTestId('column-planning')).getByText('Alpha Task')).toBeDefined()
    })
    expect(within(screen.getByTestId('column-blocked')).getByText('Beta Task')).toBeDefined()
  })

  it('both tasks roll back independently when both mutations fail', async () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDrop('task-a', 'done')
    simulateDrop('task-b', 'in_review')

    await act(async () => {
      pendingMutations[0].reject(new Error('fail a'))
      pendingMutations[1].reject(new Error('fail b'))
    })

    await waitFor(() => {
      expect(within(screen.getByTestId('column-planning')).getByText('Alpha Task')).toBeDefined()
      expect(within(screen.getByTestId('column-ready')).getByText('Beta Task')).toBeDefined()
    })
  })

  it('mutation is NOT called when dropped on same column (no rollback scenario)', () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDrop('task-a', 'planning')

    expect(mockMutate).not.toHaveBeenCalled()
    expect(pendingMutations).toHaveLength(0)
  })

  it('mutation is NOT called when dropped outside any column', () => {
    render(<KanbanBoard tasks={makeTasks()} />)

    simulateDrop('task-a', null)

    expect(mockMutate).not.toHaveBeenCalled()
  })
})
