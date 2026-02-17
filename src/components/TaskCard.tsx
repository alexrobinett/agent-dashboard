import { useDraggable } from '@dnd-kit/core'
import { getPriorityColor } from '../lib/utils'
import { GripVertical } from 'lucide-react'

interface TaskCardProps {
  task: {
    _id: string
    title: string
    assignedAgent?: string
    priority?: string
    project?: string
    status?: string
  }
}

export function TaskCard({ task }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task._id,
    data: { task },
  })

  const style: React.CSSProperties = {
    borderLeftColor: getPriorityColor(task.priority),
    ...(transform
      ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
      : {}),
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      data-testid={`task-card-${task._id}`}
      className="bg-secondary rounded-md p-3 border-l-4 hover:bg-secondary/80 transition-colors cursor-grab active:cursor-grabbing"
      style={style}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        <div
          data-testid="drag-handle"
          className="mt-0.5 text-muted-foreground/50 hover:text-muted-foreground touch-none"
          aria-hidden="true"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-secondary-foreground text-sm mb-1 line-clamp-2">
            {task.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="capitalize">{task.assignedAgent}</span>
            {task.priority && (
              <>
                <span>•</span>
                <span className="capitalize">{task.priority}</span>
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
      </div>
    </div>
  )
}
