import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { convex } from '../lib/convex'
import { api } from '../../convex/_generated/api'
import { getPriorityColor } from '../lib/utils'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFilters } from '../hooks/useFilters'
import { useSearch } from '../hooks/useSearch'
import { FilterBar } from '../components/FilterBar'
import { WorkloadChart, type WorkloadData } from '../components/WorkloadChart'

export const Route = createFileRoute('/dashboard')({
  loader: async () => {
    const emptyBoard = {
      planning: [],
      ready: [],
      in_progress: [],
      in_review: [],
      done: [],
      blocked: [],
    }

    // SSR: pre-fetch board data, but fail fast to an empty board in CI/network issues.
    const timeoutMs = 5000
    const timeoutPromise = new Promise<typeof emptyBoard>((resolve) => {
      setTimeout(() => resolve(emptyBoard), timeoutMs)
    })
    const tasksPromise = convex
      .query(api.tasks.getByStatus, {})
      .catch(() => emptyBoard)

    const tasks = await Promise.race([tasksPromise, timeoutPromise])
    
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
  // Avoid Convex React hooks during SSR; hydrate with loader data first.
  if (typeof window === 'undefined') {
    return <DashboardBoard tasks={initialData} workload={{}} />
  }

  return <DashboardLiveComponent initialData={initialData} />
}

function DashboardLiveComponent({ initialData }: { initialData: any }) {
  // Track SSR-to-subscription handoff timing
  const mountTimeRef = useRef<number>(Date.now())
  const ssrDataUsedRef = useRef<boolean>(false)
  const subscriptionActiveRef = useRef<boolean>(false)
  
  // Live subscription: Convex useQuery automatically subscribes via WebSocket
  // and keeps data in sync. Falls back to initialData during SSR hydration.
  let liveTasks: any
  try {
    liveTasks = useQuery(api.tasks.getByStatus, {})
  } catch {
    liveTasks = undefined
  }
  const tasks = liveTasks ?? initialData

  // Live workload data
  let liveWorkload: WorkloadData | undefined
  try {
    liveWorkload = useQuery(api.tasks.getWorkload, {}) as WorkloadData | undefined
  } catch {
    liveWorkload = undefined
  }
  const workload: WorkloadData = liveWorkload ?? {}

  // Log SSR hydration timing (runs once on mount)
  useEffect(() => {
    const mountTime = mountTimeRef.current
    const hydrationTime = Date.now() - mountTime
    const isUsingSSRData = tasks === initialData
    
    console.log('[SSR Handoff] Component mounted', {
      timestamp: new Date().toISOString(),
      hydrationTime: `${hydrationTime}ms`,
      usingSSRData: isUsingSSRData,
    })
    
    ssrDataUsedRef.current = true
  }, [])

  // Log WebSocket subscription status
  useEffect(() => {
    // If tasks changed from initialData, subscription is active
    const isLiveData = tasks !== initialData
    
    if (isLiveData && !subscriptionActiveRef.current) {
      const handoffTime = Date.now() - mountTimeRef.current
      
      console.log('[SSR Handoff] WebSocket subscription active', {
        timestamp: new Date().toISOString(),
        handoffTime: `${handoffTime}ms`,
        ssrDataWasUsed: ssrDataUsedRef.current,
      })
      
      subscriptionActiveRef.current = true
    }
  }, [tasks, initialData])

  return <DashboardBoard tasks={tasks} workload={workload} />
}

function DashboardBoard({ tasks, workload }: { tasks: any; workload: WorkloadData }) {
  const statusOrder = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked']
  const { filters, setFilter, clearFilters, hasActiveFilters } = useFilters()

  // Collect unique projects and agents from all tasks for dropdown options
  const { projects, agents } = useMemo(() => {
    const projectSet = new Set<string>()
    const agentSet = new Set<string>()
    for (const status of statusOrder) {
      for (const task of tasks[status] || []) {
        if (task.project) projectSet.add(task.project)
        if (task.assignedAgent) agentSet.add(task.assignedAgent)
      }
    }
    return {
      projects: Array.from(projectSet).sort(),
      agents: Array.from(agentSet).sort(),
    }
  }, [tasks])

  // Flatten all tasks for search filtering, then re-group by status
  const allTasks = useMemo(() => {
    const flat: any[] = []
    for (const status of statusOrder) {
      for (const task of tasks[status] || []) {
        flat.push({ ...task, _status: task.status ?? status })
      }
    }
    return flat
  }, [tasks])

  const { filteredTasks: searchResults } = useSearch(allTasks, filters.search)

  // Apply dropdown filters on top of search results, then re-group by status
  const filteredTasks = useMemo(() => {
    const result: Record<string, any[]> = {}
    for (const status of statusOrder) {
      result[status] = []
    }
    for (const task of searchResults) {
      if (filters.project && task.project !== filters.project) continue
      if (filters.agent && task.assignedAgent !== filters.agent) continue
      if (filters.priority && task.priority !== filters.priority) continue
      const status = task._status ?? 'planning'
      if (result[status]) {
        result[status].push(task)
      }
    }
    return result
  }, [searchResults, filters.project, filters.agent, filters.priority])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-foreground">Task Dashboard</h1>
          <div className="text-sm text-muted-foreground">
            <span
              data-testid="live-indicator"
              className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"
            ></span>
            Live
          </div>
        </div>

        <FilterBar
          filters={filters}
          onFilterChange={setFilter}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
          projects={projects}
          agents={agents}
        />

        <WorkloadChart data={workload} />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statusOrder.map((status) => {
            const statusTasks = filteredTasks[status] || []
            const count = statusTasks.length
            
            return (
              <div
                key={status}
                data-testid={`column-${status}`}
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

