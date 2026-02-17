import { useState, useCallback } from 'react'
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
import { useOptimisticTaskMove } from '../hooks/useOptimisticTaskMove'
import { KanbanColumn } from './KanbanColumn'
import { TaskCard } from './TaskCard'

const STATUS_ORDER = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked'] as const

interface KanbanBoardProps {
  tasks: Record<string, any[]>
}

export function KanbanBoard({ tasks }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<any | null>(null)
  const { displayTasks, moveTask } = useOptimisticTaskMove(tasks)

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })
  const keyboardSensor = useSensor(KeyboardSensor)
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  })
  const sensors = useSensors(pointerSensor, keyboardSensor, touchSensor)

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={displayTasks[status] || []}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
