/**
 * Sprint 4.3a: Kanban Drag-and-Drop Component Tests
 *
 * TDD tests for the DnD infrastructure:
 * - TaskCard renders with drag handle and correct data
 * - KanbanColumn renders as a drop target with correct status
 * - KanbanBoard wraps columns in DndContext
 * - Keyboard accessibility: focus, pick up, move
 * - Touch support: drag handles visible
 * - Drop on different column triggers status update mutation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// Shared mock mutation function - captured by the convex/react mock
const mockMutate = vi.fn().mockResolvedValue({ success: true })

// Mock @dnd-kit/core
const mockDndContext = vi.fn()
const mockUseDraggable = vi.fn()
const mockUseDroppable = vi.fn()
const mockDragOverlay = vi.fn()
const mockUseSensor = vi.fn()
const mockUseSensors = vi.fn()

vi.mock('@dnd-kit/core', () => ({
  DndContext: (props: any) => {
    mockDndContext(props)
    return React.createElement('div', { 'data-testid': 'dnd-context' }, props.children)
  },
  useDraggable: (config: any) => {
    mockUseDraggable(config)
    return {
      attributes: { role: 'button', tabIndex: 0, 'aria-roledescription': 'draggable', 'aria-describedby': `draggable-${config.id}` },
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
  DragOverlay: (props: any) => {
    mockDragOverlay(props)
    return React.createElement('div', { 'data-testid': 'drag-overlay' }, props.children)
  },
  KeyboardSensor: 'KeyboardSensor',
  PointerSensor: 'PointerSensor',
  TouchSensor: 'TouchSensor',
  useSensor: (...args: any[]) => {
    mockUseSensor(...args)
    return args[0]
  },
  useSensors: (...args: any[]) => {
    mockUseSensors(...args)
    return args
  },
  closestCorners: vi.fn(),
}))

// Mock convex - useMutation returns our shared mockMutate
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

import { TaskCard } from '../../components/TaskCard'
import { KanbanColumn } from '../../components/KanbanColumn'
import { KanbanBoard } from '../../components/KanbanBoard'

const mockTask = {
  _id: 'task-1',
  _creationTime: Date.now(),
  title: 'Test Task',
  assignedAgent: 'forge',
  status: 'planning',
  priority: 'high',
  project: 'agent-dashboard',
  createdBy: 'main',
  createdAt: Date.now(),
}

const mockTasks = {
  planning: [mockTask],
  ready: [
    {
      _id: 'task-2',
      _creationTime: Date.now(),
      title: 'Ready Task',
      assignedAgent: 'sentinel',
      status: 'ready',
      priority: 'normal',
      createdBy: 'main',
      createdAt: Date.now(),
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

describe('TaskCard - Draggable Task Card', () => {
  it('should render task title', () => {
    render(<TaskCard task={mockTask} />)
    expect(screen.getByText('Test Task')).toBeDefined()
  })

  it('should render assigned agent', () => {
    render(<TaskCard task={mockTask} />)
    expect(screen.getByText('forge')).toBeDefined()
  })

  it('should render priority when present', () => {
    render(<TaskCard task={mockTask} />)
    expect(screen.getByText('high')).toBeDefined()
  })

  it('should render project when present', () => {
    render(<TaskCard task={mockTask} />)
    expect(screen.getByText('agent-dashboard')).toBeDefined()
  })

  it('should call useDraggable with task id', () => {
    render(<TaskCard task={mockTask} />)
    expect(mockUseDraggable).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1' })
    )
  })

  it('should have aria attributes for accessibility', () => {
    render(<TaskCard task={mockTask} />)
    const card = screen.getByRole('button')
    expect(card.getAttribute('aria-roledescription')).toBe('draggable')
    expect(card.getAttribute('tabindex')).toBe('0')
  })

  it('should render drag handle for touch support', () => {
    render(<TaskCard task={mockTask} />)
    expect(screen.getByTestId('drag-handle')).toBeDefined()
  })

  it('should apply priority border color', () => {
    render(<TaskCard task={mockTask} />)
    const card = screen.getByTestId(`task-card-${mockTask._id}`)
    expect(card.style.borderLeftColor).toBe('rgb(239, 68, 68)') // high = red
  })

  it('should pass data attribute with task id', () => {
    render(<TaskCard task={mockTask} />)
    expect(screen.getByTestId('task-card-task-1')).toBeDefined()
  })
})

describe('KanbanColumn - Droppable Column', () => {
  it('should render column header with formatted status', () => {
    render(<KanbanColumn status="in_progress" tasks={[]} />)
    expect(screen.getByText('in progress')).toBeDefined()
  })

  it('should render task count badge', () => {
    render(<KanbanColumn status="planning" tasks={[mockTask]} />)
    const badge = screen.getByTestId('count-badge-planning')
    expect(badge.textContent).toBe('1')
  })

  it('should call useDroppable with status id', () => {
    render(<KanbanColumn status="in_progress" tasks={[]} />)
    expect(mockUseDroppable).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'in_progress' })
    )
  })

  it('should render "No tasks" message when empty', () => {
    render(<KanbanColumn status="done" tasks={[]} />)
    expect(screen.getByTestId('empty-done')).toBeDefined()
    expect(screen.getByText('No tasks')).toBeDefined()
  })

  it('should render TaskCards for each task', () => {
    const tasks = [
      mockTask,
      { ...mockTask, _id: 'task-extra', title: 'Extra Task' },
    ]
    render(<KanbanColumn status="planning" tasks={tasks} />)
    expect(screen.getByText('Test Task')).toBeDefined()
    expect(screen.getByText('Extra Task')).toBeDefined()
  })

  it('should have data-testid with column status', () => {
    render(<KanbanColumn status="blocked" tasks={[]} />)
    expect(screen.getByTestId('column-blocked')).toBeDefined()
  })

  it('should hide scrollbar chrome while keeping the lane focusable and scrollable', () => {
    render(<KanbanColumn status="planning" tasks={[mockTask]} />)
    const lane = screen.getByTestId('column-scroll-planning')

    expect(lane.className).toContain('scrollbar-chrome-hidden')
    expect(lane.className).toContain('overflow-y-auto')
    expect(lane.getAttribute('tabindex')).toBe('0')
    expect(lane.getAttribute('role')).toBe('region')
  })
})

describe('KanbanBoard - DndContext Wrapper', () => {
  it('opens task detail modal from task card detail affordance', async () => {
    const user = userEvent.setup()
    render(<KanbanBoard tasks={mockTasks} activityEntries={[]} />)

    await user.click(screen.getByTestId('task-details-button-task-1'))
    expect(screen.getByTestId('task-detail-modal')).toBeDefined()
    expect(screen.getByTestId('task-detail-title').textContent).toContain('Test Task')
  })

  it('should render DndContext wrapper', () => {
    render(<KanbanBoard tasks={mockTasks} />)
    expect(screen.getByTestId('dnd-context')).toBeDefined()
  })

  it('should render all 6 status columns', () => {
    render(<KanbanBoard tasks={mockTasks} />)
    expect(screen.getByTestId('column-planning')).toBeDefined()
    expect(screen.getByTestId('column-ready')).toBeDefined()
    expect(screen.getByTestId('column-in_progress')).toBeDefined()
    expect(screen.getByTestId('column-in_review')).toBeDefined()
    expect(screen.getByTestId('column-done')).toBeDefined()
    expect(screen.getByTestId('column-blocked')).toBeDefined()
  })

  it('should render tasks in their respective columns', () => {
    render(<KanbanBoard tasks={mockTasks} />)
    const planningColumn = screen.getByTestId('column-planning')
    expect(within(planningColumn).getByText('Test Task')).toBeDefined()

    const readyColumn = screen.getByTestId('column-ready')
    expect(within(readyColumn).getByText('Ready Task')).toBeDefined()
  })

  it('should configure sensors including keyboard and touch', () => {
    render(<KanbanBoard tasks={mockTasks} />)
    expect(mockUseSensors).toHaveBeenCalled()
    expect(mockUseSensor).toHaveBeenCalled()
  })

  it('should pass onDragEnd handler to DndContext', () => {
    render(<KanbanBoard tasks={mockTasks} />)
    expect(mockDndContext).toHaveBeenCalledWith(
      expect.objectContaining({
        onDragEnd: expect.any(Function),
      })
    )
  })

  it('should render DragOverlay for visual feedback', () => {
    render(<KanbanBoard tasks={mockTasks} />)
    expect(screen.getByTestId('drag-overlay')).toBeDefined()
  })

})

describe('KanbanBoard - Drag and Drop Behavior', () => {
  it('should call update mutation when card is dropped on a different column', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    // Get the onDragEnd handler passed to DndContext
    const dndContextProps = mockDndContext.mock.calls[mockDndContext.mock.calls.length - 1][0]
    const onDragEnd = dndContextProps.onDragEnd

    // Simulate dropping task-1 (planning) onto in_progress column
    onDragEnd({
      active: { id: 'task-1' },
      over: { id: 'in_progress' },
    })

    expect(mockMutate).toHaveBeenCalledWith({
      id: 'task-1',
      status: 'in_progress',
    })
  })

  it('should NOT call mutation when dropped on the same column', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    const dndContextProps = mockDndContext.mock.calls[mockDndContext.mock.calls.length - 1][0]
    const onDragEnd = dndContextProps.onDragEnd

    // Simulate dropping task-1 (planning) back onto planning column
    onDragEnd({
      active: { id: 'task-1' },
      over: { id: 'planning' },
    })

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('should NOT call mutation when dropped outside any column (over is null)', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    const dndContextProps = mockDndContext.mock.calls[mockDndContext.mock.calls.length - 1][0]
    const onDragEnd = dndContextProps.onDragEnd

    // Simulate dropping outside any column
    onDragEnd({
      active: { id: 'task-1' },
      over: null,
    })

    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('should track active drag item on dragStart', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    const dndContextProps = mockDndContext.mock.calls[mockDndContext.mock.calls.length - 1][0]

    // onDragStart should be provided
    expect(dndContextProps.onDragStart).toBeDefined()
  })
})

describe('Keyboard Accessibility', () => {
  it('should make task cards focusable via tabindex', () => {
    render(<TaskCard task={mockTask} />)
    const card = screen.getByRole('button')
    expect(card.getAttribute('tabindex')).toBe('0')
  })

  it('should have aria-roledescription for screen readers', () => {
    render(<TaskCard task={mockTask} />)
    const card = screen.getByRole('button')
    expect(card.getAttribute('aria-roledescription')).toBe('draggable')
  })

  it('should provide keyboard event listeners via useDraggable', () => {
    render(<TaskCard task={mockTask} />)
    // Verify useDraggable was called — its return includes keyboard listeners
    // that are spread onto the card element (onKeyDown for Space/Enter/Arrow keys)
    expect(mockUseDraggable).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-1' })
    )
    // The card element should have the role=button + tabindex from useDraggable attributes
    const card = screen.getByRole('button')
    expect(card).toBeDefined()
  })
})

describe('Touch Support', () => {
  it('should render a visible drag handle element', () => {
    render(<TaskCard task={mockTask} />)
    const handle = screen.getByTestId('drag-handle')
    expect(handle).toBeDefined()
  })

  it('should configure touch sensor in KanbanBoard', () => {
    render(<KanbanBoard tasks={mockTasks} />)
    // The useSensor calls should include TouchSensor
    const sensorCalls = mockUseSensor.mock.calls
    const sensorNames = sensorCalls.map((c: any[]) => c[0])
    expect(sensorNames).toContain('TouchSensor')
  })
})
