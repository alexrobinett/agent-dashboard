import { useDraggable } from '@dnd-kit/core'
import { getPriorityColor } from '../lib/utils'
import { GripVertical } from 'lucide-react'

interface TaskCardProps {
  task: {
    _id: string
    title: string
    description?: string
    assignedAgent?: string
    priority?: string
    project?: string
    status?: string
    taskKey?: string
  }
  onOpenDetails?: (task: TaskCardProps['task']) => void
}

export function TaskCard({ task, onOpenDetails }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task._id,
    data: { task },
  })

  const handleOpenDetails = () => {
    onOpenDetails?.(task)
  }

  const handleCardKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    dndOnKeyDown?.(event)

    if (!onOpenDetails) return
    if (event.defaultPrevented) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleOpenDetails()
    }
  }

  const { onKeyDown: dndOnKeyDown, ...restListeners } = listeners ?? {}

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
      data-shortcut-task-card="true"
      aria-haspopup={onOpenDetails ? 'dialog' : undefined}
      aria-label={onOpenDetails ? `Open details for ${task.title}` : task.title}
      className="bg-secondary rounded-md p-3 border-l-4 hover:bg-secondary/80 transition-colors cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      style={style}
      onKeyDown={handleCardKeyDown}
      {...attributes}
      {...restListeners}
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
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[11px] font-mono text-muted-foreground">{task.taskKey ?? task._id}</span>
          </div>
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
          {onOpenDetails && (
            <span
              role="link"
              tabIndex={0}
              data-testid={`task-details-button-${task._id}`}
              className="mt-2 inline-block text-xs text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onOpenDetails(task)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  onOpenDetails(task)
                }
              }}
            >
              Open details
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
