import { X, Search } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'
import type { FilterState } from '../hooks/useFilters'

export interface FilterBarProps {
  filters: FilterState
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void
  onClear: () => void
  hasActiveFilters: boolean
  projects?: string[]
  agents?: string[]
}

const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'] as const

export function FilterBar({
  filters,
  onFilterChange,
  onClear,
  hasActiveFilters,
  projects = [],
  agents = [],
}: FilterBarProps) {
  return (
    <div
      data-testid="filter-bar"
      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6"
    >
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          data-testid="filter-search"
          placeholder="Search tasks..."
          aria-label="Search tasks"
          value={filters.search}
          onChange={(e) => onFilterChange('search', e.target.value)}
          className={cn(
            'h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          )}
        />
      </div>

      <select
        data-testid="filter-project"
        aria-label="Filter by project"
        value={filters.project}
        onChange={(e) => onFilterChange('project', e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">All Projects</option>
        {projects.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>

      <select
        data-testid="filter-agent"
        aria-label="Filter by agent"
        value={filters.agent}
        onChange={(e) => onFilterChange('agent', e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">All Agents</option>
        {agents.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      <select
        data-testid="filter-priority"
        aria-label="Filter by priority"
        value={filters.priority}
        onChange={(e) => onFilterChange('priority', e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground capitalize focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">All Priorities</option>
        {PRIORITY_OPTIONS.map((p) => (
          <option key={p} value={p} className="capitalize">
            {p}
          </option>
        ))}
      </select>

      {hasActiveFilters && (
        <Button
          data-testid="filter-clear"
          variant="ghost"
          size="sm"
          onClick={onClear}
          aria-label="Clear all filters"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}
