import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardBoard } from '../../routes/dashboard'

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
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
    filters: { search: '', project: '', agent: '', priority: '' },
    setFilter: vi.fn(),
    clearFilters: vi.fn(),
    hasActiveFilters: false,
  }),
}))

vi.mock('../../hooks/useSearch', () => ({
  useSearch: (tasks: any[]) => ({ filteredTasks: tasks }),
}))

vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: () => undefined,
}))

vi.mock('../../components/FilterBar', () => ({
  FilterBar: () => <div data-testid="filter-bar" />,
}))

vi.mock('../../components/KanbanBoard', () => ({
  KanbanBoard: () => <div data-testid="kanban-board" />,
}))

vi.mock('../../components/WorkloadChart', () => ({
  WorkloadChart: () => <div data-testid="workload-chart" />,
}))

vi.mock('../../components/ActivityTimeline', () => ({
  ActivityTimeline: () => <div data-testid="activity-timeline" />,
}))

vi.mock('../../components/KeyboardShortcutsOverlay', () => ({
  KeyboardShortcutsOverlay: () => null,
}))

vi.mock('../../components/ui/sheet', () => ({
  Sheet: ({ children }: any) => <>{children}</>,
  SheetContent: ({ children }: any) => <>{children}</>,
  SheetDescription: ({ children }: any) => <>{children}</>,
  SheetHeader: ({ children }: any) => <>{children}</>,
  SheetTitle: ({ children }: any) => <>{children}</>,
}))

const tasks = {
  planning: [{ _id: '1', title: 'Task 1', status: 'planning' }],
  ready: [],
  in_progress: [],
  in_review: [],
  done: [],
  blocked: [],
}

describe('DashboardBoard view toggles', () => {
  it('hides workload panel in board view', () => {
    render(<DashboardBoard tasks={tasks} workload={{}} activityEntries={[]} activeView="board" />)

    expect(screen.getByTestId('board-view-panel')).toBeDefined()
    expect(screen.queryByTestId('workload-view-panel')).toBeNull()
  })

  it('shows workload panel and hides board panel in workload view', () => {
    render(<DashboardBoard tasks={tasks} workload={{ forge: { total: 1, byStatus: {}, byPriority: {} } as any }} activityEntries={[]} activeView="workload" />)

    expect(screen.getByTestId('workload-view-panel')).toBeDefined()
    expect(screen.queryByTestId('board-view-panel')).toBeNull()
  })
})
