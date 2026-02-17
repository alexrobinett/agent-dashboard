import { useState, useEffect, useMemo, useRef } from 'react'

const DEBOUNCE_MS = 300

export interface SearchableTask {
  title?: string
  description?: string
  [key: string]: unknown
}

export function useSearch<T extends SearchableTask>(tasks: T[], query: string) {
  const trimmedQuery = query.trim()
  const isEmptyQuery = trimmedQuery === ''

  const [debouncedQuery, setDebouncedQuery] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (trimmedQuery === '') {
      // Clear search immediately — no debounce needed
      if (timerRef.current) clearTimeout(timerRef.current)
      setDebouncedQuery('')
      return
    }

    timerRef.current = setTimeout(() => {
      setDebouncedQuery(trimmedQuery)
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [trimmedQuery])

  const isSearching = !isEmptyQuery && trimmedQuery !== debouncedQuery

  const filteredTasks = useMemo(() => {
    if (debouncedQuery === '') return tasks

    const q = debouncedQuery.toLowerCase()
    return tasks.filter((task) => {
      const title = (task.title ?? '').toLowerCase()
      const description = (task.description ?? '').toLowerCase()
      return title.includes(q) || description.includes(q)
    })
  }, [tasks, debouncedQuery])

  return { filteredTasks, isSearching }
}
