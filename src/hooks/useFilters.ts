import { useState, useCallback, useMemo } from 'react'

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface FilterState {
  project: string
  agent: string
  priority: string
  search: string
}

export const EMPTY_FILTERS: FilterState = {
  project: '',
  agent: '',
  priority: '',
  search: '',
}

function parseSearchParams(): FilterState {
  if (typeof window === 'undefined') return { ...EMPTY_FILTERS }
  const params = new URLSearchParams(window.location.search)
  return {
    project: params.get('project') ?? '',
    agent: params.get('agent') ?? '',
    priority: params.get('priority') ?? '',
    search: params.get('search') ?? '',
  }
}

function syncToURL(filters: FilterState) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  if (filters.project) params.set('project', filters.project)
  if (filters.agent) params.set('agent', filters.agent)
  if (filters.priority) params.set('priority', filters.priority)
  if (filters.search) params.set('search', filters.search)

  const search = params.toString()
  const newURL = search
    ? `${window.location.pathname}?${search}`
    : window.location.pathname
  window.history.replaceState(null, '', newURL)
}

export function useFilters() {
  const [filters, setFiltersState] = useState<FilterState>(parseSearchParams)

  const setFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFiltersState((prev) => {
        const next = { ...prev, [key]: value }
        syncToURL(next)
        return next
      })
    },
    []
  )

  const clearFilters = useCallback(() => {
    setFiltersState({ ...EMPTY_FILTERS })
    syncToURL(EMPTY_FILTERS)
  }, [])

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((v) => v !== ''),
    [filters]
  )

  return {
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,
  }
}
