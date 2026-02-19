import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { Search } from 'lucide-react'
import { useOptimisticTaskMove } from '../hooks/useOptimisticTaskMove'
import { useSearch } from '../hooks/useSearch'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from './TaskCard'

const STATUS_ORDER = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked'] as const

type Task = {
  _id: string
  title: string
  description?: string
  assignedAgent?: string
  priority?: string
  project?: string
  status?: string
}

interface KanbanBoardProps {
  tasks: Record<string, Task[]>
}

function regroupByStatus(tasks: Task[]) {
  const grouped: Record<string, Task[]> = {
    planning: [],
    ready: [],
    in_progress: [],
    in_review: [],
    done: [],
    blocked: [],
  }

  for (const task of tasks) {
    const status = task.status ?? 'planning'
    grouped[status] = [...(grouped[status] || []), task]
  }

  return grouped
}

export function KanbanBoard({ tasks }: KanbanBoardProps) {
  if (typeof window === 'undefined') {
    return <KanbanBoardStatic tasks={tasks} />
  }
  return <KanbanBoardInteractive tasks={tasks} />
}

function KanbanBoardInteractive({ tasks }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [laneSearchQuery, setLaneSearchQuery] = useState('')
  const { displayTasks, moveTask } = useOptimisticTaskMove(tasks)

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })
  const keyboardSensor = useSensor(KeyboardSensor)
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  })
  const sensors = useSensors(pointerSensor, keyboardSensor, touchSensor)

  const allDisplayTasks = useMemo(
    () => STATUS_ORDER.flatMap((status) => displayTasks[status] || []),
    [displayTasks],
  )

  const { filteredTasks } = useSearch(allDisplayTasks, laneSearchQuery)
  const filteredByLane = useMemo(() => regroupByStatus(filteredTasks), [filteredTasks])
  const hasSearch = laneSearchQuery.trim().length > 0
  const hasSearchResults = filteredTasks.length > 0

  // Build a lookup from task id to its current status (using display tasks for accuracy)
  const taskStatusMap = new Map<string, string>()
  for (const status of STATUS_ORDER) {
    for (const task of displayTasks[status] || []) {
      taskStatusMap.set(task._id, status)
    }
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const task = active.data?.current?.task
    if (task) {
      setActiveTask(task)
    }
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveTask(null)

      if (!over) return

      const taskId = active.id as string
      const newStatus = over.id as string
      const currentStatus = taskStatusMap.get(taskId)

      // Only update if dropped on a different column
      if (currentStatus === newStatus) return

      moveTask(taskId, currentStatus || 'planning', newStatus)
    },
    [moveTask, taskStatusMap],
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="mb-4">
        <label htmlFor="lane-search" className="sr-only">
          Search tasks in board lanes
        </label>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="lane-search"
            data-testid="lane-search-input"
            type="search"
            placeholder="Search visible tasks in board..."
            value={laneSearchQuery}
            onChange={(e) => setLaneSearchQuery(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          />
        </div>
        {hasSearch && !hasSearchResults && (
          <p data-testid="lane-search-no-results" className="mt-2 text-sm text-muted-foreground">
            No matching tasks for “{laneSearchQuery.trim()}”.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="kanban-grid">
        {STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={filteredByLane[status] || []}
            emptyMessage={hasSearch ? 'No matching tasks' : 'No tasks'}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function KanbanBoardStatic({ tasks }: KanbanBoardProps) {
  return (
    <>
      <div className="mb-4">
        <label htmlFor="lane-search" className="sr-only">
          Search tasks in board lanes
        </label>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="lane-search"
            data-testid="lane-search-input"
            type="search"
            placeholder="Search visible tasks in board..."
            value=""
            readOnly
            className="h-9 w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="kanban-grid">
        {STATUS_ORDER.map((status) => (
          <KanbanColumn key={status} status={status} tasks={tasks[status] || []} />
        ))}
      </div>
    </>
  )
}
