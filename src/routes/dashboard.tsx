import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { convex } from '../lib/convex'
import { api } from '../../convex/_generated/api'
import { Suspense } from 'react'

export const Route = createFileRoute('/dashboard')({
  loader: async () => {
    // SSR: Pre-fetch data on the server using ConvexHttpClient
    const tasks = await convex.query(api.tasks.getByStatus, {})
    
    return {
      tasks,
      loadedAt: Date.now(),
    }
  },
  component: DashboardPage,
  errorComponent: DashboardErrorComponent,
  pendingComponent: DashboardPendingComponent,
})

function DashboardPage() {
  const loaderData = Route.useLoaderData()
  
  return (
    <Suspense fallback={<DashboardPendingComponent />}>
      <DashboardComponent initialData={loaderData.tasks} />
    </Suspense>
  )
}

function DashboardComponent({ initialData }: { initialData: any }) {
  // Live subscription: Convex useQuery automatically subscribes via WebSocket
  // and keeps data in sync. Falls back to initialData during SSR hydration.
  const tasks = useQuery(api.tasks.getByStatus, {}) ?? initialData

  const statusOrder = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked']
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-foreground">Task Dashboard</h1>
          <div className="text-sm text-muted-foreground">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Live
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statusOrder.map((status) => {
            const statusTasks = tasks[status] || []
            const count = statusTasks.length
            
            return (
              <div
                key={status}
                className="bg-card rounded-lg border border-border p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-card-foreground capitalize">
                    {status.replace('_', ' ')}
                  </h2>
                  <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    {count}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {statusTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4 text-center">
                      No tasks
                    </p>
                  ) : (
                    statusTasks.map((task: any) => (
                      <div
                        key={task._id}
                        className="bg-secondary rounded-md p-3 border-l-4 hover:bg-secondary/80 transition-colors cursor-pointer"
                        style={{
                          borderLeftColor: getPriorityColor(task.priority),
                        }}
                      >
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
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DashboardPendingComponent() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    </div>
  )
}

function DashboardErrorComponent({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full p-6 bg-destructive/10 border border-destructive rounded-lg">
        <h2 className="text-xl font-semibold text-destructive mb-2">
          Failed to load dashboard
        </h2>
        <p className="text-destructive-foreground mb-4 text-sm">
          {error.message || 'An unknown error occurred'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}

function getPriorityColor(priority?: string): string {
  switch (priority?.toLowerCase()) {
    case 'high':
      return '#EF4444' // red
    case 'normal':
    case 'medium':
      return '#F59E0B' // amber
    case 'low':
      return '#3B82F6' // blue
    default:
      return '#6B7280' // gray
  }
}
