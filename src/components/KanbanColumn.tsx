import { useDroppable } from '@dnd-kit/core'
import { TaskCard } from './TaskCard'

interface KanbanColumnProps {
  status: string
  tasks: Array<{
    _id: string
    title: string
    assignedAgent?: string
    priority?: string
    project?: string
    status?: string
  }>
}

export function KanbanColumn({ status, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      data-testid={`column-${status}`}
      className={`bg-card rounded-lg border border-border p-4 shadow-sm transition-shadow ${
        isOver ? 'shadow-lg ring-2 ring-primary/30' : 'hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-card-foreground capitalize">
          {status.replace('_', ' ')}
        </h2>
        <span
          data-testid={`count-badge-${status}`}
          className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full"
        >
          {tasks.length}
        </span>
      </div>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p
            data-testid={`empty-${status}`}
            className="text-sm text-muted-foreground italic py-4 text-center"
          >
            No tasks
          </p>
        ) : (
          tasks.map((task) => <TaskCard key={task._id} task={task} />)
        )}
      </div>
    </div>
  )
}
