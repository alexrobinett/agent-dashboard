import { Skeleton } from './ui/skeleton'

export function TaskCardSkeleton() {
  return (
    <div
      data-testid="task-card-skeleton"
      className="bg-secondary rounded-md p-3 border-l-4 border-muted"
    >
      <div className="flex items-start gap-2">
        <Skeleton className="h-4 w-4 mt-0.5 rounded" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function KanbanColumnSkeleton({ taskCount = 3 }: { taskCount?: number }) {
  return (
    <div
      data-testid="kanban-column-skeleton"
      className="bg-card rounded-lg border border-border p-4 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-8 rounded-full" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: taskCount }, (_, i) => (
          <TaskCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export function BoardSkeleton() {
  return (
    <div
      data-testid="board-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Loading board"
      className="min-h-screen bg-background p-6"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-16" />
        </div>

        {/* Filter bar skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <Skeleton className="h-9 flex-1 min-w-[200px]" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>

        {/* Workload chart skeleton */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-sm">
          <Skeleton className="h-6 w-36 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 flex-1 rounded" />
                <Skeleton className="h-4 w-8" />
              </div>
            ))}
          </div>
        </div>

        {/* Kanban columns skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <KanbanColumnSkeleton taskCount={2} />
          <KanbanColumnSkeleton taskCount={3} />
          <KanbanColumnSkeleton taskCount={1} />
          <KanbanColumnSkeleton taskCount={2} />
          <KanbanColumnSkeleton taskCount={4} />
          <KanbanColumnSkeleton taskCount={1} />
        </div>

        {/* Activity timeline skeleton */}
        <div className="mt-8 rounded-lg border border-border bg-card p-4 shadow-sm">
          <Skeleton className="h-6 w-24 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1 border-l-2 border-border pl-4 py-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
