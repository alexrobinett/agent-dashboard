import { useState, useEffect, useMemo, useRef } from 'react'

const DEBOUNCE_MS = 300

export interface SearchableTask {
  _id?: string
  title?: string
  description?: string
  taskKey?: string
  [key: string]: unknown
}

export function useSearch<T extends SearchableTask>(tasks: T[], query: string) {
  const trimmedQuery = query.trim()
  const isEmptyQuery = trimmedQuery === ''

  const [debouncedQuery, setDebouncedQuery] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(
      () => {
        setDebouncedQuery(trimmedQuery)
      },
      trimmedQuery === '' ? 0 : DEBOUNCE_MS,
    )

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [trimmedQuery])

  const isSearching = !isEmptyQuery && trimmedQuery !== debouncedQuery

  const filteredTasks = useMemo(() => {
    if (trimmedQuery === '') return tasks
    if (debouncedQuery === '') return tasks

    const q = debouncedQuery.toLowerCase()
    return tasks.filter((task) => {
      const title = (task.title ?? '').toLowerCase()
      const description = (task.description ?? '').toLowerCase()
      const taskKey = (task.taskKey ?? '').toLowerCase()
      const id = (task._id ?? '').toLowerCase()
      return title.includes(q) || description.includes(q) || taskKey.includes(q) || id.includes(q)
    })
  }, [tasks, debouncedQuery, trimmedQuery])

  return { filteredTasks, isSearching }
}
