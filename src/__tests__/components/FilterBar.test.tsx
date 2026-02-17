import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { FilterBar, type FilterBarProps } from '../../components/FilterBar'
import { EMPTY_FILTERS, type FilterState } from '../../hooks/useFilters'

// --- helpers -----------------------------------------------------------

function defaultProps(overrides: Partial<FilterBarProps> = {}): FilterBarProps {
  return {
    filters: { ...EMPTY_FILTERS },
    onFilterChange: vi.fn(),
    onClear: vi.fn(),
    hasActiveFilters: false,
    projects: ['agent-dashboard', 'options-trader'],
    agents: ['forge', 'sentinel', 'oracle'],
    ...overrides,
  }
}

function renderBar(overrides: Partial<FilterBarProps> = {}) {
  const props = defaultProps(overrides)
  const result = render(<FilterBar {...props} />)
  return { ...result, props }
}

// --- tests -------------------------------------------------------------

describe('FilterBar', () => {
  describe('Initial render', () => {
    it('renders the filter bar container', () => {
      renderBar()
      expect(screen.getByTestId('filter-bar')).toBeDefined()
    })

    it('renders search input with placeholder', () => {
      renderBar()
      const search = screen.getByTestId('filter-search') as HTMLInputElement
      expect(search).toBeDefined()
      expect(search.placeholder).toBe('Search tasks...')
      expect(search.value).toBe('')
    })

    it('renders project dropdown with all options', () => {
      renderBar()
      const select = screen.getByTestId('filter-project') as HTMLSelectElement
      expect(select).toBeDefined()
      expect(select.value).toBe('')
      // "All Projects" + 2 projects
      expect(select.options).toHaveLength(3)
      expect(select.options[0].textContent).toBe('All Projects')
      expect(select.options[1].textContent).toBe('agent-dashboard')
      expect(select.options[2].textContent).toBe('options-trader')
    })

    it('renders agent dropdown with all options', () => {
      renderBar()
      const select = screen.getByTestId('filter-agent') as HTMLSelectElement
      expect(select).toBeDefined()
      expect(select.value).toBe('')
      // "All Agents" + 3 agents
      expect(select.options).toHaveLength(4)
      expect(select.options[0].textContent).toBe('All Agents')
    })

    it('renders priority dropdown with all options', () => {
      renderBar()
      const select = screen.getByTestId('filter-priority') as HTMLSelectElement
      expect(select).toBeDefined()
      expect(select.value).toBe('')
      // "All Priorities" + 4 priorities
      expect(select.options).toHaveLength(5)
      expect(select.options[0].textContent).toBe('All Priorities')
    })

    it('does not show clear button when no filters active', () => {
      renderBar({ hasActiveFilters: false })
      expect(screen.queryByTestId('filter-clear')).toBeNull()
    })
  })

  describe('Filter interactions', () => {
    it('calls onFilterChange with project value', () => {
      const { props } = renderBar()
      const select = screen.getByTestId('filter-project') as HTMLSelectElement
      fireEvent.change(select, { target: { value: 'agent-dashboard' } })
      expect(props.onFilterChange).toHaveBeenCalledWith('project', 'agent-dashboard')
    })

    it('calls onFilterChange with agent value', () => {
      const { props } = renderBar()
      const select = screen.getByTestId('filter-agent') as HTMLSelectElement
      fireEvent.change(select, { target: { value: 'forge' } })
      expect(props.onFilterChange).toHaveBeenCalledWith('agent', 'forge')
    })

    it('calls onFilterChange with priority value', () => {
      const { props } = renderBar()
      const select = screen.getByTestId('filter-priority') as HTMLSelectElement
      fireEvent.change(select, { target: { value: 'high' } })
      expect(props.onFilterChange).toHaveBeenCalledWith('priority', 'high')
    })

    it('calls onFilterChange with search text on input', async () => {
      const { props } = renderBar()
      const input = screen.getByTestId('filter-search') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'deploy' } })
      expect(props.onFilterChange).toHaveBeenCalledWith('search', 'deploy')
    })

    it('resets dropdown to default when selecting empty value', () => {
      const { props } = renderBar({
        filters: { ...EMPTY_FILTERS, project: 'agent-dashboard' },
      })
      const select = screen.getByTestId('filter-project') as HTMLSelectElement
      expect(select.value).toBe('agent-dashboard')
      fireEvent.change(select, { target: { value: '' } })
      expect(props.onFilterChange).toHaveBeenCalledWith('project', '')
    })
  })

  describe('Clear all filters', () => {
    it('shows clear button when filters are active', () => {
      renderBar({ hasActiveFilters: true })
      expect(screen.getByTestId('filter-clear')).toBeDefined()
    })

    it('calls onClear when clear button clicked', () => {
      const { props } = renderBar({ hasActiveFilters: true })
      fireEvent.click(screen.getByTestId('filter-clear'))
      expect(props.onClear).toHaveBeenCalledTimes(1)
    })

    it('hides clear button when hasActiveFilters is false', () => {
      renderBar({ hasActiveFilters: false })
      expect(screen.queryByTestId('filter-clear')).toBeNull()
    })
  })

  describe('Displays current filter state', () => {
    it('reflects current project filter value', () => {
      renderBar({
        filters: { ...EMPTY_FILTERS, project: 'options-trader' },
      })
      const select = screen.getByTestId('filter-project') as HTMLSelectElement
      expect(select.value).toBe('options-trader')
    })

    it('reflects current agent filter value', () => {
      renderBar({
        filters: { ...EMPTY_FILTERS, agent: 'sentinel' },
      })
      const select = screen.getByTestId('filter-agent') as HTMLSelectElement
      expect(select.value).toBe('sentinel')
    })

    it('reflects current priority filter value', () => {
      renderBar({
        filters: { ...EMPTY_FILTERS, priority: 'urgent' },
      })
      const select = screen.getByTestId('filter-priority') as HTMLSelectElement
      expect(select.value).toBe('urgent')
    })

    it('reflects current search text', () => {
      renderBar({
        filters: { ...EMPTY_FILTERS, search: 'hello' },
      })
      const input = screen.getByTestId('filter-search') as HTMLInputElement
      expect(input.value).toBe('hello')
    })

    it('supports multiple active filters simultaneously', () => {
      renderBar({
        filters: {
          project: 'agent-dashboard',
          agent: 'forge',
          priority: 'high',
          search: 'api',
        },
        hasActiveFilters: true,
      })
      expect((screen.getByTestId('filter-project') as HTMLSelectElement).value).toBe('agent-dashboard')
      expect((screen.getByTestId('filter-agent') as HTMLSelectElement).value).toBe('forge')
      expect((screen.getByTestId('filter-priority') as HTMLSelectElement).value).toBe('high')
      expect((screen.getByTestId('filter-search') as HTMLInputElement).value).toBe('api')
      expect(screen.getByTestId('filter-clear')).toBeDefined()
    })
  })

  describe('Accessibility', () => {
    it('has accessible label on search input', () => {
      renderBar()
      expect(screen.getByLabelText('Search tasks')).toBeDefined()
    })

    it('has accessible label on project dropdown', () => {
      renderBar()
      expect(screen.getByLabelText('Filter by project')).toBeDefined()
    })

    it('has accessible label on agent dropdown', () => {
      renderBar()
      expect(screen.getByLabelText('Filter by agent')).toBeDefined()
    })

    it('has accessible label on priority dropdown', () => {
      renderBar()
      expect(screen.getByLabelText('Filter by priority')).toBeDefined()
    })

    it('has accessible label on clear button', () => {
      renderBar({ hasActiveFilters: true })
      expect(screen.getByLabelText('Clear all filters')).toBeDefined()
    })
  })

  describe('Empty options', () => {
    it('renders with no project options', () => {
      renderBar({ projects: [] })
      const select = screen.getByTestId('filter-project') as HTMLSelectElement
      expect(select.options).toHaveLength(1) // only "All Projects"
    })

    it('renders with no agent options', () => {
      renderBar({ agents: [] })
      const select = screen.getByTestId('filter-agent') as HTMLSelectElement
      expect(select.options).toHaveLength(1) // only "All Agents"
    })
  })
})

describe('useFilters hook - URL sync', () => {
  beforeEach(() => {
    // Reset URL before each test
    window.history.replaceState(null, '', window.location.pathname)
  })

  it('initializes with empty filters when no URL params', async () => {
    const { useFilters } = await import('../../hooks/useFilters')

    let hookResult: ReturnType<typeof useFilters> | null = null
    function TestComponent() {
      hookResult = useFilters()
      return null
    }
    render(<TestComponent />)

    expect(hookResult!.filters).toEqual(EMPTY_FILTERS)
    expect(hookResult!.hasActiveFilters).toBe(false)
  })

  it('reads initial filters from URL params', async () => {
    window.history.replaceState(null, '', '?project=agent-dashboard&priority=high')

    // Re-import to pick up new URL
    vi.resetModules()
    const { useFilters } = await import('../../hooks/useFilters')

    let hookResult: ReturnType<typeof useFilters> | null = null
    function TestComponent() {
      hookResult = useFilters()
      return null
    }
    render(<TestComponent />)

    expect(hookResult!.filters.project).toBe('agent-dashboard')
    expect(hookResult!.filters.priority).toBe('high')
    expect(hookResult!.hasActiveFilters).toBe(true)
  })

  it('syncs filter changes to URL', async () => {
    vi.resetModules()
    const { useFilters } = await import('../../hooks/useFilters')

    let hookResult: ReturnType<typeof useFilters> | null = null
    function TestComponent() {
      hookResult = useFilters()
      return null
    }
    const { rerender } = render(<TestComponent />)

    // Set a filter via the hook
    act(() => {
      hookResult!.setFilter('agent', 'forge')
    })

    const params = new URLSearchParams(window.location.search)
    expect(params.get('agent')).toBe('forge')
  })

  it('clears URL params on clearFilters', async () => {
    window.history.replaceState(null, '', '?project=test&agent=forge')
    vi.resetModules()
    const { useFilters } = await import('../../hooks/useFilters')

    let hookResult: ReturnType<typeof useFilters> | null = null
    function TestComponent() {
      hookResult = useFilters()
      return null
    }
    const { rerender } = render(<TestComponent />)

    act(() => {
      hookResult!.clearFilters()
    })

    expect(window.location.search).toBe('')
    expect(hookResult!.hasActiveFilters).toBe(false)
  })
})
