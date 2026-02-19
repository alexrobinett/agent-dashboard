import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

let draggableState: { transform: { x: number; y: number } | null; isDragging: boolean } = {
  transform: null,
  isDragging: false,
}

vi.mock('@dnd-kit/core', () => ({
  DndContext: (props: any) => React.createElement('div', { 'data-testid': 'dnd-context' }, props.children),
  DragOverlay: (props: any) => React.createElement('div', { 'data-testid': 'drag-overlay' }, props.children),
  useDraggable: (config: any) => ({
    attributes: { role: 'button', tabIndex: 0, 'aria-roledescription': 'draggable' },
    listeners: { onKeyDown: vi.fn(), onPointerDown: vi.fn() },
    setNodeRef: vi.fn(),
    transform: draggableState.transform,
    isDragging: draggableState.isDragging,
    data: { current: { task: config.data?.task } },
  }),
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  KeyboardSensor: 'KeyboardSensor',
  PointerSensor: 'PointerSensor',
  TouchSensor: 'TouchSensor',
  useSensor: (sensor: any) => sensor,
  useSensors: (...args: any[]) => args,
  closestCorners: vi.fn(),
}))

vi.mock('../../hooks/useSearch', () => ({
  useSearch: (tasks: any[], query: string) => ({
    filteredTasks: query.trim() === 'zzz' ? [] : tasks,
    isSearching: false,
  }),
}))

vi.mock('../../components/KanbanColumn', () => ({
  KanbanColumn: ({ status, tasks, emptyMessage, onOpenTaskDetails }: any) => {
    React.useEffect(() => {
      if (status === 'planning' && tasks[0]) onOpenTaskDetails?.(tasks[0])
    }, [status, tasks, onOpenTaskDetails])

    return (
      <div data-testid={`column-${status}`}>
        {tasks.length === 0 ? <span data-testid={`empty-${status}`}>{emptyMessage ?? 'No tasks'}</span> : null}
        {tasks.map((task: any) => (
          <button
            key={task._id}
            data-testid={`open-${task._id}`}
            onClick={() => onOpenTaskDetails?.(task)}
          >
            open
          </button>
        ))}
      </div>
    )
  },
}))

vi.mock('../../components/TaskDetailModal', () => ({
  TaskDetailModal: ({ task, onTaskPatched }: any) => (
    <div data-testid="task-detail-modal">
      <span data-testid="task-detail-title">{task.title}</span>
      <button data-testid="patch-task" onClick={() => onTaskPatched?.(task._id, { title: 'Patched title' })}>
        patch
      </button>
    </div>
  ),
}))

const mockMutate = vi.fn().mockResolvedValue({ ok: true })
vi.mock('convex/react', () => ({ useMutation: () => mockMutate, useQuery: () => null }))

import { TaskCard } from '../../components/TaskCard'
import { KanbanBoard } from '../../components/KanbanBoard'

const baseTask = {
  _id: 'task-1',
  title: 'Test Task',
  description: 'Description',
  assignedAgent: 'forge',
  status: 'planning',
  priority: 'high',
  project: 'agent-dashboard',
  taskKey: 'T-1',
}

const tasks = {
  planning: [baseTask],
  ready: [],
  in_progress: [],
  in_review: [],
  done: [],
  blocked: [],
}

describe('KanbanBoard/TaskCard branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    draggableState = { transform: null, isDragging: false }
  })

  it('renders TaskCard without details affordance when no handler is provided', () => {
    render(<TaskCard task={baseTask} />)
    expect(screen.queryByTestId('task-details-button-task-1')).toBeNull()
  })

  it('applies TaskCard drag transform and dragging opacity branches', () => {
    draggableState = { transform: { x: 10, y: 20 }, isDragging: true }
    render(<TaskCard task={baseTask} />)

    const card = screen.getByTestId('task-card-task-1')
    expect(card.style.transform).toBe('translate(10px, 20px)')
    expect(card.style.opacity).toBe('0.5')
  })

  it('shows lane search no-results state when query has no match', async () => {
    const user = userEvent.setup()
    render(<KanbanBoard tasks={tasks} />)

    await user.type(screen.getByTestId('lane-search-input'), 'zzz')
    expect(screen.getByTestId('lane-search-no-results')).toBeInTheDocument()
  })

  it('renders board with drag overlay', () => {
    render(<KanbanBoard tasks={tasks} />)
    expect(screen.getByTestId('dnd-context')).toBeInTheDocument()
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
  })
})
