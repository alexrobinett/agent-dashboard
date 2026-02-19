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
  emptyMessage?: string
}

export function KanbanColumn({ status, tasks, emptyMessage = 'No tasks' }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      data-testid={`column-${status}`}
      className={`bg-card rounded-lg border border-border shadow-sm transition-shadow max-h-[70vh] min-h-[20rem] flex flex-col overflow-hidden ${
        isOver ? 'shadow-lg ring-2 ring-primary/30' : 'hover:shadow-md'
      }`}
    >
      <div
        data-testid={`column-header-${status}`}
        className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur-sm"
      >
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

      <div
        data-testid={`column-scroll-${status}`}
        tabIndex={0}
        role="region"
        aria-label={`${status.replace('_', ' ')} tasks`}
        className="scrollbar-chrome-hidden flex-1 overflow-y-auto px-4 py-3 space-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        {tasks.length === 0 ? (
          <p
            data-testid={`empty-${status}`}
            className="text-sm text-muted-foreground italic py-4 text-center"
          >
            {emptyMessage}
          </p>
        ) : (
          tasks.map((task) => <TaskCard key={task._id} task={task} />)
        )}
      </div>
    </div>
  )
}
