import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { convex } from '../lib/convex'
import { api } from '../../convex/_generated/api'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useFilters } from '../hooks/useFilters'
import { useSearch } from '../hooks/useSearch'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { FilterBar } from '../components/FilterBar'
import { WorkloadChart, type WorkloadData } from '../components/WorkloadChart'
import { KanbanBoard } from '../components/KanbanBoard'
import { ActivityTimeline, type ActivityEntry } from '../components/ActivityTimeline'
import { Button } from '../components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet'
import { ShortcutHint } from '../components/ShortcutHint'
import { KeyboardShortcutsOverlay } from '../components/KeyboardShortcutsOverlay'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { getSession } from '../lib/auth-middleware'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { EmptyState } from '../components/EmptyState'
import { BoardSkeleton } from '../components/skeletons'
import { toast } from 'sonner'

type DashboardView = 'board' | 'workload'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
  },
  validateSearch: (search: Record<string, unknown>): { view?: DashboardView } => {
    return {
      view: search.view === 'workload' ? 'workload' : 'board',
    }
  },
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
  const search = Route.useSearch()

  return (
    <ErrorBoundary title="Dashboard error">
      <Suspense fallback={<BoardSkeleton />}>
        <DashboardComponent initialData={loaderData.tasks} initialView={search.view ?? 'board'} />
      </Suspense>
    </ErrorBoundary>
  )
}

function DashboardComponent({
  initialData,
  initialView,
}: {
  initialData: any
  initialView: DashboardView
}) {
  // Avoid Convex React hooks during SSR; hydrate with loader data first.
  if (typeof window === 'undefined') {
    return (
      <DashboardBoard
        tasks={initialData}
        workload={{}}
        activityEntries={[]}
        activeView={initialView}
      />
    )
  }

  return <DashboardLiveComponent initialData={initialData} initialView={initialView} />
}

function DashboardLiveComponent({
  initialData,
  initialView,
}: {
  initialData: any
  initialView: DashboardView
}) {
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

  // Live activity timeline data
  let liveActivityEntries: ActivityEntry[] | undefined
  try {
    liveActivityEntries = useQuery(api.activityLog.getRecentActivity, {
      limit: 50,
    }) as ActivityEntry[] | undefined
  } catch {
    liveActivityEntries = undefined
  }
  const activityEntries: ActivityEntry[] = liveActivityEntries ?? []

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

  return (
    <DashboardBoard
      tasks={tasks}
      workload={workload}
      activityEntries={activityEntries}
      activeView={initialView}
    />
  )
}

export function DashboardBoard({
  tasks,
  workload,
  activityEntries,
  activeView,
}: {
  tasks: any
  workload: WorkloadData
  activityEntries: ActivityEntry[]
  activeView: DashboardView
}) {
  const statusOrder = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked']
  const { filters, setFilter, clearFilters, hasActiveFilters } = useFilters()
  const reducedMotion = useReducedMotion()
  const navigate = useNavigate()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskError, setNewTaskError] = useState<string | null>(null)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const focusedTaskIndexRef = useRef<number>(-1)
  let createTask: ReturnType<typeof useMutation> | null
  try {
    createTask = useMutation(api.tasks.createTask)
  } catch {
    createTask = null
  }

  const setActiveView = useCallback(
    (view: DashboardView) => {
      navigate({
        to: '/dashboard',
        search: (prev: Record<string, unknown>) => ({ ...prev, view }),
      })
    },
    [navigate],
  )

  const handleAgentClick = useCallback(
    (agent: string) => {
      setFilter('agent', agent)
      setActiveView('board')
    },
    [setActiveView, setFilter],
  )

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

  const focusTaskCard = useCallback((direction: 1 | -1) => {
    const taskCards = Array.from(
      document.querySelectorAll<HTMLElement>('[data-shortcut-task-card="true"]'),
    )
    if (taskCards.length === 0) return

    const activeElement = document.activeElement
    const activeIndex = taskCards.findIndex((card) => card === activeElement)
    const currentIndex = activeIndex >= 0 ? activeIndex : focusedTaskIndexRef.current

    let nextIndex: number
    if (currentIndex < 0) {
      nextIndex = direction > 0 ? 0 : taskCards.length - 1
    } else {
      nextIndex = Math.min(taskCards.length - 1, Math.max(0, currentIndex + direction))
    }

    taskCards[nextIndex]?.focus()
    focusedTaskIndexRef.current = nextIndex
  }, [])

  useEffect(() => {
    focusedTaskIndexRef.current = -1
  }, [filters.search, filters.project, filters.agent, filters.priority, activeView])

  useKeyboardShortcuts({
    onToggleShortcutsHelp: () => setIsShortcutsOpen((prev) => !prev),
    onOpenNewTask: () => setIsNewTaskOpen(true),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onEscape: () => {
      setIsNewTaskOpen(false)
      setIsShortcutsOpen(false)
    },
    onNavigateDown: () => focusTaskCard(1),
    onNavigateUp: () => focusTaskCard(-1),
    onGoToBoard: () => setActiveView('board'),
    onGoToWorkload: () => setActiveView('workload'),
  })

  // Check if all columns are empty after filtering
  const totalFilteredTasks = useMemo(
    () => Object.values(filteredTasks).reduce((sum, col) => sum + col.length, 0),
    [filteredTasks],
  )

  // Check if the board has any tasks at all (pre-filter)
  const totalTasks = useMemo(
    () => statusOrder.reduce((sum, s) => sum + (tasks[s]?.length ?? 0), 0),
    [tasks],
  )

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = newTaskTitle.trim()
    if (!title) {
      setNewTaskError('Title is required.')
      return
    }

    setIsCreatingTask(true)
    setNewTaskError(null)
    try {
      if (!createTask) {
        throw new Error('Task creation is unavailable in this context')
      }
      await createTask({
        title,
        priority: 'normal',
        project: '',
        createdBy: 'user',
      })
      setIsNewTaskOpen(false)
      setNewTaskTitle('')
      setNewTaskDescription('')
      setNewTaskError(null)
      toast.success('Task created')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create task'
      toast.error(message)
    } finally {
      setIsCreatingTask(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-foreground">Task Dashboard</h1>
          <div className="text-sm text-muted-foreground">
            <span
              data-testid="live-indicator"
              className={`inline-block w-2 h-2 bg-green-500 rounded-full mr-2${reducedMotion ? '' : ' animate-pulse'}`}
            ></span>
            Live
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            data-testid="view-board-btn"
            variant={activeView === 'board' ? 'default' : 'outline'}
            size="sm"
            className="group"
            onClick={() => setActiveView('board')}
          >
            Board View
            <ShortcutHint keys="g b" />
          </Button>
          <Button
            data-testid="view-workload-btn"
            variant={activeView === 'workload' ? 'default' : 'outline'}
            size="sm"
            className="group"
            onClick={() => setActiveView('workload')}
          >
            Workload View
            <ShortcutHint keys="g w" />
          </Button>
          <Button
            data-testid="new-task-button"
            size="sm"
            className="group ml-auto"
            onClick={() => setIsNewTaskOpen(true)}
          >
            New Task
            <ShortcutHint keys="n" />
          </Button>
          <Button
            data-testid="shortcuts-help-button"
            variant="ghost"
            size="sm"
            className="group"
            onClick={() => setIsShortcutsOpen(true)}
          >
            Shortcuts
            <ShortcutHint keys="?" />
          </Button>
        </div>

        <FilterBar
          filters={filters}
          onFilterChange={setFilter}
          onClear={clearFilters}
          hasActiveFilters={hasActiveFilters}
          projects={projects}
          agents={agents}
          searchInputRef={searchInputRef}
        />

        {activeView === 'workload' && (
          <ErrorBoundary title="Workload chart error" inline>
            <div data-testid="workload-view-panel">
              <WorkloadChart data={workload} onAgentClick={handleAgentClick} />
            </div>
          </ErrorBoundary>
        )}

        {activeView !== 'workload' && (
          hasActiveFilters && totalFilteredTasks === 0 ? (
            <EmptyState variant="no-results" />
          ) : (
            <ErrorBoundary title="Board error" inline>
              <div data-testid="board-view-panel">
                {/* KanbanBoard handles empty columns natively ("No tasks" per column).
                    We show an EmptyState notice above the board only when there are
                    truly no tasks in the system, so the columns remain accessible. */}
                {totalTasks === 0 && !hasActiveFilters && (
                  <EmptyState variant="no-data" />
                )}
                <KanbanBoard tasks={filteredTasks} activityEntries={activityEntries} />
              </div>
            </ErrorBoundary>
          )
        )}

        <div className="mt-8">
          <ErrorBoundary title="Activity timeline error" inline>
            <ActivityTimeline entries={activityEntries} />
          </ErrorBoundary>
        </div>
      </div>

      <KeyboardShortcutsOverlay
        open={isShortcutsOpen}
        onOpenChange={setIsShortcutsOpen}
      />

      <Sheet open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
        <SheetContent data-testid="new-task-sheet" side="right">
          <SheetHeader>
            <SheetTitle>Create New Task</SheetTitle>
            <SheetDescription>
              Quick-create a task from anywhere with the keyboard.
            </SheetDescription>
          </SheetHeader>
          <form className="mt-6 space-y-4" onSubmit={(event) => void handleCreateTask(event)}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Title</span>
              <input
                data-testid="new-task-title-input"
                type="text"
                placeholder="Task title"
                value={newTaskTitle}
                onChange={(event) => {
                  setNewTaskTitle(event.target.value)
                  if (newTaskError) setNewTaskError(null)
                }}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
            {newTaskError && (
              <p role="alert" className="text-sm text-destructive">{newTaskError}</p>
            )}
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Description</span>
              <textarea
                rows={5}
                placeholder="Task details"
                value={newTaskDescription}
                onChange={(event) => setNewTaskDescription(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
            <Button
              data-testid="new-task-submit"
              className="w-full"
              type="submit"
              disabled={isCreatingTask}
            >
              Create Task
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function DashboardPendingComponent() {
  return <BoardSkeleton />
}

/**
 * Re-throws a pre-caught error so ErrorBoundary can render its standard fallback UI.
 * This avoids duplicating error UI in DashboardErrorComponent.
 */
function RethrowError({ error }: { error: Error }): never {
  throw error
}

/**
 * Route-level error component for the dashboard route.
 * Composes ErrorBoundary so we don't duplicate error UI.
 */
function DashboardErrorComponent({ error }: { error: Error }) {
  return (
    <ErrorBoundary title="Failed to load dashboard">
      <RethrowError error={error} />
    </ErrorBoundary>
  )
}
