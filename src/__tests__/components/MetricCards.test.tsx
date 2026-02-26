/**
 * MetricCards / KPI cards rendering tests
 * Tests the 4 MetricCard components rendered inside DashboardBoard's workload view.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardBoard } from '../../routes/dashboard'

// ── Convex mocks ──────────────────────────────────────────
vi.mock('../../../convex/_generated/api', () => ({
  api: {
    tasks: {
      createTask: 'tasks:createTask',
      claimTask: 'tasks:claimTask',
      completeTask: 'tasks:completeTask',
      updateTask: 'tasks:updateTask',
      searchTasks: 'tasks:searchTasks',
      getMetrics: 'tasks:getMetrics',
    },
  },
}))

vi.mock('convex/react', () => ({
  useMutation: (_ref: string) => vi.fn(),
  useQuery: (_ref: string) => undefined,
  ConvexReactClient: class {
    setAuth() {}
    clearAuth() {}
    onUpdate() { return () => {} }
    watchQuery() { return { getCurrentValue: () => undefined, subscribe: () => () => {} } }
  },
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    createFileRoute: () => () => ({
      useLoaderData: () => ({ tasks: {} }),
      useSearch: () => ({ view: 'workload' }),
    }),
    redirect: vi.fn(),
  }
})

vi.mock('../../hooks/useFilters', () => ({
  useFilters: () => ({
    filters: { search: '', project: '', agent: '', priority: '' },
    setFilter: vi.fn(),
    clearFilters: vi.fn(),
    hasActiveFilters: false,
  }),
}))

vi.mock('../../hooks/useSearch', () => ({
  useSearch: (_tasks: unknown[], _q: string) => ({ filteredTasks: [], isSearching: false }),
}))

vi.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => false }))

vi.mock('../../hooks/useKeyboardShortcuts', () => ({ useKeyboardShortcuts: vi.fn() }))

vi.mock('../../components/FilterBar', () => ({
  FilterBar: () => <div data-testid="filter-bar" />,
}))

vi.mock('../../components/KanbanBoard', () => ({
  KanbanBoard: () => <div data-testid="kanban-board" />,
}))

vi.mock('../../components/WorkloadChart', () => ({
  WorkloadChart: () => <div data-testid="workload-chart" />,
}))

vi.mock('../../components/AgentPresenceWidget', () => ({
  AgentPresenceWidget: () => <div data-testid="agent-presence" />,
}))

vi.mock('../../components/CommandPalette', () => ({
  CommandPalette: () => null,
}))

vi.mock('../../components/TaskDetailModal', () => ({
  TaskDetailModal: () => null,
}))

const defaultTasks = {
  planning: [],
  ready: [],
  in_progress: [],
  in_review: [],
  done: [],
  blocked: [],
}

function renderWorkload(metrics?: Record<string, number>, metricsLoading?: boolean) {
  return render(
    <DashboardBoard
      tasks={defaultTasks}
      workload={{}}
      activityEntries={[]}
      agentPresence={[]}
      activeView="workload"
      metrics={metrics as any}
      metricsLoading={metricsLoading}
    />,
  )
}

// ── Tests ─────────────────────────────────────────────────
describe('MetricCards (KPI cards)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders 4 stat cards in the workload view', () => {
    renderWorkload({ totalTasks: 10, completedTasks: 5, activeAgents: 2, avgCompletionMs: 0 })
    const panel = screen.getByTestId('workload-metrics-cards')
    expect(panel).toBeInTheDocument()
    expect(screen.getByText('Total Tasks')).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Active Agents')).toBeInTheDocument()
    expect(screen.getByText('Avg Completion Time')).toBeInTheDocument()
  })

  it('shows skeleton elements when metricsLoading is true', () => {
    renderWorkload(undefined, true)
    expect(screen.getByTestId('metric-skeleton-total-tasks')).toBeInTheDocument()
    expect(screen.getByTestId('metric-skeleton-completed')).toBeInTheDocument()
    expect(screen.getByTestId('metric-skeleton-active-agents')).toBeInTheDocument()
    expect(screen.getByTestId('metric-skeleton-avg-completion-time')).toBeInTheDocument()
  })

  it('shows correct numeric values when metrics data is present', () => {
    renderWorkload({ totalTasks: 42, completedTasks: 17, activeAgents: 3, avgCompletionMs: 3_600_000 })
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    // 3_600_000ms = 60 min = 1h 0m
    expect(screen.getByText('1h 0m')).toBeInTheDocument()
  })

  it('shows zero values gracefully when metrics are all zero', () => {
    renderWorkload({ totalTasks: 0, completedTasks: 0, activeAgents: 0, avgCompletionMs: 0 })
    const zeros = screen.getAllByText('0')
    // At least totalTasks, completedTasks, activeAgents show as 0
    expect(zeros.length).toBeGreaterThanOrEqual(3)
  })
})
