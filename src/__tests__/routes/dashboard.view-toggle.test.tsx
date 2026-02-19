import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DashboardBoard } from '../../routes/dashboard'

const mockCreateTask = vi.fn()

vi.mock('../../../convex/_generated/api', () => ({
  api: {
    tasks: {
      createTask: 'tasks:createTask',
    },
  },
}))

vi.mock('convex/react', () => ({
  useMutation: (ref: string) => {
    if (ref === 'tasks:createTask') return mockCreateTask
    return vi.fn()
  },
  ConvexReactClient: class {
    setAuth() {}
    clearAuth() {}
    onUpdate() { return () => {} }
    watchQuery() { return { getCurrentValue: () => undefined, subscribe: () => () => {} } }
  },
}))

const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
    error: (...args: any[]) => mockToastError(...args),
  },
}))

const mockNavigate = vi.fn()
const mockSetFilter = vi.fn()
const mockClearFilters = vi.fn()
const mockUseSearch = vi.fn()
const mockKeyboardShortcuts = vi.fn()

let mockFilters = { search: '', project: '', agent: '', priority: '' }
let mockHasActiveFilters = false
let mockReducedMotion = false

const recorded = {
  kanbanTasks: undefined as Record<string, any[]> | undefined,
  projects: [] as string[],
  agents: [] as string[],
  workloadOnAgentClick: undefined as ((agent: string) => void) | undefined,
  keyboardHandlers: undefined as Record<string, () => void> | undefined,
  sheetOpen: false,
  shortcutsOpen: false,
}

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    createFileRoute: () =>
      () => ({
        useLoaderData: () => ({ tasks: {} }),
        useSearch: () => ({ view: 'board' }),
      }),
    redirect: vi.fn(),
  }
})

vi.mock('../../hooks/useFilters', () => ({
  useFilters: () => ({
    filters: mockFilters,
    setFilter: mockSetFilter,
    clearFilters: mockClearFilters,
    hasActiveFilters: mockHasActiveFilters,
  }),
}))

vi.mock('../../hooks/useSearch', () => ({
  useSearch: (...args: any[]) => mockUseSearch(...args),
}))

vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}))

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: (handlers: Record<string, () => void>) => {
    recorded.keyboardHandlers = handlers
    mockKeyboardShortcuts(handlers)
  },
}))

vi.mock('../../components/FilterBar', () => ({
  FilterBar: ({ projects, agents }: any) => {
    recorded.projects = projects
    recorded.agents = agents
    return <div data-testid="filter-bar" />
  },
}))

vi.mock('../../components/KanbanBoard', () => ({
  KanbanBoard: ({ tasks }: any) => {
    recorded.kanbanTasks = tasks
    return <div data-testid="kanban-board" />
  },
}))

vi.mock('../../components/WorkloadChart', () => ({
  WorkloadChart: ({ onAgentClick }: any) => {
    recorded.workloadOnAgentClick = onAgentClick
    return (
      <button data-testid="workload-chart" onClick={() => onAgentClick('forge')}>
        workload-chart
      </button>
    )
  },
}))

vi.mock('../../components/ActivityTimeline', () => ({
  ActivityTimeline: () => <div data-testid="activity-timeline" />,
}))

vi.mock('../../components/KeyboardShortcutsOverlay', () => ({
  KeyboardShortcutsOverlay: ({ open }: { open: boolean }) => {
    recorded.shortcutsOpen = open
    return <div data-testid="shortcuts-overlay">{open ? 'open' : 'closed'}</div>
  },
}))

vi.mock('../../components/EmptyState', () => ({
  EmptyState: ({ variant }: { variant: string }) => (
    <div data-testid={`empty-state-${variant}`}>empty-{variant}</div>
  ),
}))

vi.mock('../../components/ui/sheet', () => ({
  Sheet: ({ children, open }: any) => {
    recorded.sheetOpen = !!open
    return <>{children}</>
  },
  SheetContent: ({ children }: any) => <>{children}</>,
  SheetDescription: ({ children }: any) => <>{children}</>,
  SheetHeader: ({ children }: any) => <>{children}</>,
  SheetTitle: ({ children }: any) => <>{children}</>,
}))

const defaultTasks = {
  planning: [{ _id: '1', title: 'Task 1', status: 'planning', project: 'alpha', assignedAgent: 'forge', priority: 'high' }],
  ready: [{ _id: '2', title: 'Task 2', status: 'ready', project: 'beta', assignedAgent: 'sentinel', priority: 'low' }],
  in_progress: [{ _id: '3', title: 'Task 3', project: 'alpha', assignedAgent: 'forge', priority: 'urgent' }],
  in_review: [],
  done: [],
  blocked: [],
}

function renderBoard(overrides?: { tasks?: any; activeView?: 'board' | 'workload' }) {
  return render(
    <DashboardBoard
      tasks={overrides?.tasks ?? defaultTasks}
      workload={{ forge: { total: 1, byStatus: {}, byPriority: {} } as any }}
      activityEntries={[]}
      activeView={overrides?.activeView ?? 'board'}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateTask.mockResolvedValue('ok')
  mockToastSuccess.mockReset()
  mockToastError.mockReset()
  mockFilters = { search: '', project: '', agent: '', priority: '' }
  mockHasActiveFilters = false
  mockReducedMotion = false
  mockUseSearch.mockImplementation((tasks: any[]) => ({ filteredTasks: tasks }))
  recorded.kanbanTasks = undefined
  recorded.projects = []
  recorded.agents = []
  recorded.workloadOnAgentClick = undefined
  recorded.keyboardHandlers = undefined
  recorded.sheetOpen = false
  recorded.shortcutsOpen = false
})

describe('DashboardBoard view toggles and board branches', () => {
  it('shows board panel in board view and workload panel in workload view', () => {
    renderBoard({ activeView: 'board' })
    expect(screen.getByTestId('board-view-panel')).toBeDefined()
    expect(screen.queryByTestId('workload-view-panel')).toBeNull()

    renderBoard({ activeView: 'workload' })
    expect(screen.getByTestId('workload-view-panel')).toBeDefined()
    expect(screen.queryAllByTestId('board-view-panel').length).toBe(1)
  })

  it('uses reduced motion class when configured', () => {
    mockReducedMotion = true
    renderBoard()

    const liveIndicator = screen.getByTestId('live-indicator')
    expect(liveIndicator.className.includes('animate-pulse')).toBe(false)
  })

  it('builds project/agent options and filters tasks by project/agent/priority', () => {
    mockFilters = { search: '', project: 'alpha', agent: 'forge', priority: 'urgent' }
    mockHasActiveFilters = true
    renderBoard()

    expect(recorded.projects).toEqual(['alpha', 'beta'])
    expect(recorded.agents).toEqual(['forge', 'sentinel'])
    expect(recorded.kanbanTasks?.in_progress).toHaveLength(1)
    expect(recorded.kanbanTasks?.planning).toHaveLength(0)
    expect(recorded.kanbanTasks?.ready).toHaveLength(0)
  })

  it('falls back task _status to column status and ignores unknown status buckets', () => {
    mockUseSearch.mockImplementation(() => ({
      filteredTasks: [
        { _id: 'a', title: 'A', _status: 'done' },
        { _id: 'b', title: 'B' },
        { _id: 'c', title: 'C', _status: 'not-real' },
      ],
    }))

    renderBoard()

    expect(recorded.kanbanTasks?.done).toHaveLength(1)
    expect(recorded.kanbanTasks?.planning).toHaveLength(1)
    expect(Object.values(recorded.kanbanTasks ?? {}).flat().find((t: any) => t._id === 'c')).toBeUndefined()
  })

  it('shows no-results empty state when filters active and all filtered columns are empty', () => {
    mockHasActiveFilters = true
    mockUseSearch.mockImplementation(() => ({ filteredTasks: [] }))

    renderBoard()

    expect(screen.getByTestId('empty-state-no-results')).toBeDefined()
    expect(screen.queryByTestId('board-view-panel')).toBeNull()
  })

  it('shows no-data empty state when board has no tasks and no active filters', () => {
    renderBoard({
      tasks: { planning: [], ready: [], in_progress: [], in_review: [], done: [], blocked: [] },
    })

    expect(screen.getByTestId('empty-state-no-data')).toBeDefined()
    expect(screen.getByTestId('board-view-panel')).toBeDefined()
  })

  it('wires button and shortcut handlers for view toggles/sheets and workload click', () => {
    renderBoard({ activeView: 'workload' })

    fireEvent.click(screen.getByTestId('view-board-btn'))
    fireEvent.click(screen.getByTestId('view-workload-btn'))
    expect(mockNavigate).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByTestId('workload-chart'))
    expect(mockSetFilter).toHaveBeenCalledWith('agent', 'forge')
    expect(mockNavigate).toHaveBeenCalledTimes(3)

    fireEvent.click(screen.getByTestId('new-task-button'))
    expect(recorded.sheetOpen).toBe(true)

    fireEvent.click(screen.getByTestId('shortcuts-help-button'))
    expect(recorded.shortcutsOpen).toBe(true)

    act(() => {
      recorded.keyboardHandlers?.onEscape()
    })
    expect(recorded.sheetOpen).toBe(false)
    expect(recorded.shortcutsOpen).toBe(false)

    act(() => {
      recorded.keyboardHandlers?.onToggleShortcutsHelp()
    })
    expect(recorded.shortcutsOpen).toBe(true)

    act(() => {
      recorded.keyboardHandlers?.onOpenNewTask()
    })
    expect(recorded.sheetOpen).toBe(true)
  })

  it('supports keyboard card focus navigation and no-card guard', () => {
    const { rerender } = renderBoard()

    const card1 = document.createElement('button')
    card1.setAttribute('data-shortcut-task-card', 'true')
    const card2 = document.createElement('button')
    card2.setAttribute('data-shortcut-task-card', 'true')
    document.body.appendChild(card1)
    document.body.appendChild(card2)

    recorded.keyboardHandlers?.onNavigateDown()
    expect(document.activeElement).toBe(card1)

    recorded.keyboardHandlers?.onNavigateDown()
    expect(document.activeElement).toBe(card2)

    recorded.keyboardHandlers?.onNavigateUp()
    expect(document.activeElement).toBe(card1)

    card1.remove()
    card2.remove()

    recorded.keyboardHandlers?.onNavigateDown()

    rerender(
      <DashboardBoard
        tasks={defaultTasks}
        workload={{}}
        activityEntries={[]}
        activeView="workload"
      />,
    )

    const card3 = document.createElement('button')
    card3.setAttribute('data-shortcut-task-card', 'true')
    document.body.appendChild(card3)

    recorded.keyboardHandlers?.onNavigateUp()
    expect(document.activeElement).toBe(card3)
    card3.remove()
  })
})

describe('handleCreateTask', () => {
  it('shows validation error when title is empty and does not call createTask', async () => {
    const user = userEvent.setup()
    renderBoard()

    // Open the new task sheet
    await user.click(screen.getByTestId('new-task-button'))

    // Submit with empty title
    await user.click(screen.getByTestId('new-task-submit'))

    expect(screen.getByRole('alert')).toHaveTextContent('Title is required.')
    expect(mockCreateTask).not.toHaveBeenCalled()
  })

  it('calls createTask with title and description, then shows success toast', async () => {
    const user = userEvent.setup()
    renderBoard()

    await user.click(screen.getByTestId('new-task-button'))

    await user.type(screen.getByTestId('new-task-title-input'), 'New test task')
    await user.type(screen.getByTestId('new-task-description-input'), 'Task description')

    await user.click(screen.getByTestId('new-task-submit'))

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith({
        title: 'New test task',
        description: 'Task description',
        priority: 'normal',
        project: '',
        createdBy: 'user',
      })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('Task created')
  })

  it('calls createTask without description when description is blank', async () => {
    const user = userEvent.setup()
    renderBoard()

    await user.click(screen.getByTestId('new-task-button'))
    await user.type(screen.getByTestId('new-task-title-input'), 'Title only task')
    await user.click(screen.getByTestId('new-task-submit'))

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith({
        title: 'Title only task',
        description: undefined,
        priority: 'normal',
        project: '',
        createdBy: 'user',
      })
    })
  })

  it('shows error toast when createTask throws', async () => {
    const user = userEvent.setup()
    mockCreateTask.mockRejectedValueOnce(new Error('Server error'))
    renderBoard()

    await user.click(screen.getByTestId('new-task-button'))
    await user.type(screen.getByTestId('new-task-title-input'), 'Failing task')
    await user.click(screen.getByTestId('new-task-submit'))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Server error')
    })
  })

  it('clears validation error when user starts typing in title', async () => {
    const user = userEvent.setup()
    renderBoard()

    await user.click(screen.getByTestId('new-task-button'))

    // Submit with empty title to trigger error
    await user.click(screen.getByTestId('new-task-submit'))
    expect(screen.getByRole('alert')).toHaveTextContent('Title is required.')

    // Start typing to clear the error
    await user.type(screen.getByTestId('new-task-title-input'), 'A')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
