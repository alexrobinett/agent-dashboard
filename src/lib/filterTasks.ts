import type { FilterState } from '../hooks/useFilters'

interface Task {
  title: string
  description?: string
  project?: string
  assignedAgent?: string
  priority: string
}

export function filterTasks<T extends Task>(tasks: T[], filters: FilterState): T[] {
  return tasks.filter((task) => {
    if (filters.project && task.project !== filters.project) return false
    if (filters.agent && task.assignedAgent !== filters.agent) return false
    if (filters.priority && task.priority !== filters.priority) return false
    if (filters.search) {
      const query = filters.search.toLowerCase()
      const title = task.title.toLowerCase()
      const description = (task.description ?? '').toLowerCase()
      if (!title.includes(query) && !description.includes(query)) return false
    }
    return true
  })
}
