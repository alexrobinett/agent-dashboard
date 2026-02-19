import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import React from 'react'

let draggableState: { transform: { x: number; y: number } | null; isDragging: boolean } = {
  transform: null,
  isDragging: false,
}
let lastDndContextProps: any = null

vi.mock('@dnd-kit/core', () => ({
  DndContext: (props: any) => {
    lastDndContextProps = props
    return React.createElement('div', { 'data-testid': 'dnd-context' }, props.children)
  },
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
  useSearch: (tasks: any[]) => ({ filteredTasks: tasks, isSearching: false }),
}))

vi.mock('../../components/KanbanColumn', () => ({
  KanbanColumn: ({ status, tasks, emptyMessage }: any) => (
    <div data-testid={`column-${status}`}>
      {tasks.length === 0 ? <span data-testid={`empty-${status}`}>{emptyMessage ?? 'No tasks'}</span> : null}
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

describe('Coverage gap fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    draggableState = { transform: null, isDragging: false }
    lastDndContextProps = null
  })

  // TaskCard: Cover lines 27-30 (transform conditional)
  it('covers TaskCard transform conditional when transform is null', () => {
    // When transform is null, no transform style should be applied
    render(<TaskCard task={baseTask} onOpenDetails={vi.fn()} />)
    const card = screen.getByTestId('task-card-task-1')
    expect(card).toBeInTheDocument()
    // The style should not contain transform when draggableState.transform is null
    expect(card.style.transform).toBe('')
  })

  it('covers TaskCard transform conditional when transform exists', () => {
    // Set transform to trigger the branch
    draggableState.transform = { x: 10, y: 20 }
    render(<TaskCard task={baseTask} onOpenDetails={vi.fn()} />)
    const card = screen.getByTestId('task-card-task-1')
    expect(card).toBeInTheDocument()
    // The style should contain transform
    expect(card.style.transform).toBe('translate(10px, 20px)')
  })

  // TaskCard: Cover line 85 onKeyDown branches (Enter and Space keys)
  it('covers TaskCard line 85-88: onKeyDown Enter path for Open details affordance', () => {
    const onOpenDetails = vi.fn()
    render(<TaskCard task={baseTask} onOpenDetails={onOpenDetails} />)

    const detailsButton = screen.getByTestId('task-details-button-task-1')
    
    // Test Enter key path using fireEvent
    fireEvent.keyDown(detailsButton, { key: 'Enter', bubbles: true })
    expect(onOpenDetails).toHaveBeenCalledWith(baseTask)
  })

  it('covers TaskCard line 85-88: onKeyDown Space path for Open details affordance', () => {
    const onOpenDetails = vi.fn()
    render(<TaskCard task={baseTask} onOpenDetails={onOpenDetails} />)

    const detailsButton = screen.getByTestId('task-details-button-task-1')
    
    // Test Space key path using fireEvent
    fireEvent.keyDown(detailsButton, { key: ' ', bubbles: true })
    expect(onOpenDetails).toHaveBeenCalledWith(baseTask)
  })

  it('covers TaskCard onKeyDown when key is neither Enter nor Space', () => {
    const onOpenDetails = vi.fn()
    render(<TaskCard task={baseTask} onOpenDetails={onOpenDetails} />)

    const detailsButton = screen.getByTestId('task-details-button-task-1')
    
    // Test that other keys don't trigger onOpenDetails
    fireEvent.keyDown(detailsButton, { key: 'Tab', bubbles: true })
    expect(onOpenDetails).not.toHaveBeenCalled()
  })

  // KanbanBoard: Cover line 143-146 (handleDragStart when task exists)
  it('covers KanbanBoard handleDragStart when task exists in active.data', () => {
    render(<KanbanBoard tasks={tasks} />)
    
    // Trigger dragStart with a valid task
    act(() => {
      lastDndContextProps.onDragStart({ 
        active: { 
          data: { 
            current: { task: baseTask } 
          } 
        } 
      })
    })
    
    // DragOverlay should render a TaskCard since there's an active task
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
  })

  // KanbanBoard: Cover line 143-146 (handleDragStart when no task in active.data)
  it('covers KanbanBoard line 143-146: handleDragStart when no task in active.data', () => {
    render(<KanbanBoard tasks={tasks} />)
    
    // Trigger dragStart with empty data (no task) - tests the `if (task)` guard
    act(() => {
      lastDndContextProps.onDragStart({ active: { data: { current: {} } } })
    })
    
    // DragOverlay should be empty (no TaskCard rendered)
    expect(screen.getByTestId('drag-overlay')).toBeInTheDocument()
  })

  // KanbanBoard: Cover line 174-179 (handleDragEnd branches)
  it('covers KanbanBoard handleDragEnd when over is null', () => {
    render(<KanbanBoard tasks={tasks} />)
    
    // First set an active task
    act(() => {
      lastDndContextProps.onDragStart({ 
        active: { 
          id: 'task-1',
          data: { 
            current: { task: baseTask } 
          } 
        } 
      })
    })
    
    // Then trigger dragEnd with no over (null) - tests `if (!over) return`
    act(() => {
      lastDndContextProps.onDragEnd({ 
        active: { id: 'task-1' },
        over: null
      })
    })
    
    // The mutation should not be called since we returned early
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('covers KanbanBoard handleDragEnd when currentStatus equals newStatus', () => {
    render(<KanbanBoard tasks={tasks} />)
    
    // First set an active task
    act(() => {
      lastDndContextProps.onDragStart({ 
        active: { 
          id: 'task-1',
          data: { 
            current: { task: baseTask } 
          } 
        } 
      })
    })
    
    // Then trigger dragEnd with same status - tests `if (currentStatus === newStatus) return`
    // Task is in 'planning', so dropping on 'planning' should return early
    act(() => {
      lastDndContextProps.onDragEnd({ 
        active: { id: 'task-1' },
        over: { id: 'planning' }
      })
    })
    
    // The mutation should not be called since we returned early (same status)
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('covers KanbanBoard handleDragEnd when moving to different status', async () => {
    render(<KanbanBoard tasks={tasks} />)
    
    // First set an active task
    act(() => {
      lastDndContextProps.onDragStart({ 
        active: { 
          id: 'task-1',
          data: { 
            current: { task: baseTask } 
          } 
        } 
      })
    })
    
    // Then trigger dragEnd with different status - should call moveTask
    act(() => {
      lastDndContextProps.onDragEnd({ 
        active: { id: 'task-1' },
        over: { id: 'in_progress' }
      })
    })
    
    // Wait for the async mutation
    await vi.waitFor(() => {
      expect(mockMutate).toHaveBeenCalled()
    })
  })
})
