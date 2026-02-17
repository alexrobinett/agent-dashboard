import { describe, it, expect } from 'vitest'
import { filterTasks } from '../../lib/filterTasks'
import { createMockTask, type MockTask } from '../../test/fixtures'
import { EMPTY_FILTERS, type FilterState } from '../../hooks/useFilters'

// Shared fixture tasks
function createTestTasks(): MockTask[] {
  return [
    createMockTask({
      _id: 'task-1' as MockTask['_id'],
      title: 'Build dashboard UI',
      description: 'Create the main dashboard layout',
      project: 'agent-dashboard',
      assignedAgent: 'forge',
      priority: 'high',
    }),
    createMockTask({
      _id: 'task-2' as MockTask['_id'],
      title: 'Fix login bug',
      description: 'Users cannot log in with SSO',
      project: 'options-trader',
      assignedAgent: 'sentinel',
      priority: 'urgent',
    }),
    createMockTask({
      _id: 'task-3' as MockTask['_id'],
      title: 'Write API tests',
      description: 'Add integration tests for REST endpoints',
      project: 'agent-dashboard',
      assignedAgent: 'oracle',
      priority: 'normal',
    }),
    createMockTask({
      _id: 'task-4' as MockTask['_id'],
      title: 'Deploy staging environment',
      description: 'Set up CI/CD pipeline for staging',
      project: 'options-trader',
      assignedAgent: 'forge',
      priority: 'low',
    }),
    createMockTask({
      _id: 'task-5' as MockTask['_id'],
      title: 'Review PR #42',
      description: undefined,
      project: 'agent-dashboard',
      assignedAgent: 'sentinel',
      priority: 'high',
    }),
  ]
}

describe('filterTasks', () => {
  describe('empty filters', () => {
    it('returns all tasks when filters are empty', () => {
      const tasks = createTestTasks()
      const result = filterTasks(tasks, EMPTY_FILTERS)
      expect(result).toHaveLength(5)
      expect(result).toEqual(tasks)
    })

    it('returns empty array when given empty task list', () => {
      const result = filterTasks([], EMPTY_FILTERS)
      expect(result).toEqual([])
    })
  })

  describe('project filter', () => {
    it('filters by exact project match', () => {
      const tasks = createTestTasks()
      const filters: FilterState = { ...EMPTY_FILTERS, project: 'agent-dashboard' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(3)
      expect(result.every((t) => t.project === 'agent-dashboard')).toBe(true)
    })

    it('returns no tasks for non-existent project', () => {
      const tasks = createTestTasks()
      const filters: FilterState = { ...EMPTY_FILTERS, project: 'nonexistent' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(0)
    })

    it('excludes tasks with undefined project', () => {
      const tasks = [
        createMockTask({ title: 'No project task', project: undefined }),
        createMockTask({ title: 'Has project', project: 'my-project' }),
      ]
      const filters: FilterState = { ...EMPTY_FILTERS, project: 'my-project' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Has project')
    })
  })

  describe('agent filter', () => {
    it('filters by exact agent match', () => {
      const tasks = createTestTasks()
      const filters: FilterState = { ...EMPTY_FILTERS, agent: 'forge' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(2)
      expect(result.every((t) => t.assignedAgent === 'forge')).toBe(true)
    })

    it('returns no tasks for non-existent agent', () => {
      const tasks = createTestTasks()
      const filters: FilterState = { ...EMPTY_FILTERS, agent: 'nonexistent' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(0)
    })

    it('excludes tasks with undefined assignedAgent', () => {
      const tasks = [
        createMockTask({ title: 'Unassigned', assignedAgent: undefined }),
        createMockTask({ title: 'Assigned', assignedAgent: 'forge' }),
      ]
      const filters: FilterState = { ...EMPTY_FILTERS, agent: 'forge' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Assigned')
    })
  })

  describe('priority filter', () => {
    it('filters by exact priority match', () => {
      const tasks = createTestTasks()
      const filters: FilterState = { ...EMPTY_FILTERS, priority: 'high' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(2)
      expect(result.every((t) => t.priority === 'high')).toBe(true)
    })

    it('returns only urgent tasks when filtering by urgent', () => {
      const tasks = createTestTasks()
      const filters: FilterState = { ...EMPTY_FILTERS, priority: 'urgent' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Fix login bug')
    })

    it('returns no tasks for non-matching priority', () => {
      const tasks = [createMockTask({ priority: 'high' })]
      const filters: FilterState = { ...EMPTY_FILTERS, priority: 'low' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(0)
    })
  })

  describe('search filter', () => {
    it('matches search text in title (case-insensitive)', () => {
      const tasks = createTestTasks()
      const filters: FilterState = { ...EMPTY_FILTERS, search: 'dashboard' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Build dashboard UI')
    })

    it('matches search text in description (case-insensitive)', () => {
      const tasks = createTestTasks()
      const filters: FilterState = { ...EMPTY_FILTERS, search: 'SSO' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Fix login bug')
    })

    it('is case-insensitive for title matches', () => {
      const tasks = createTestTasks()
      const filters: FilterState = { ...EMPTY_FILTERS, search: 'BUILD DASHBOARD' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Build dashboard UI')
    })

    it('is case-insensitive for description matches', () => {
      const tasks = createTestTasks()
      const filters: FilterState = { ...EMPTY_FILTERS, search: 'rest endpoints' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Write API tests')
    })

    it('matches partial text', () => {
      const tasks = createTestTasks()
      const filters: FilterState = { ...EMPTY_FILTERS, search: 'bug' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Fix login bug')
    })

    it('handles tasks with undefined description', () => {
      const tasks = createTestTasks()
      const filters: FilterState = { ...EMPTY_FILTERS, search: 'Review' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Review PR #42')
    })

    it('returns no tasks when search matches nothing', () => {
      const tasks = createTestTasks()
      const filters: FilterState = { ...EMPTY_FILTERS, search: 'zzzznonexistent' }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(0)
    })
  })

  describe('combined filters (AND logic)', () => {
    it('combines project and agent filters', () => {
      const tasks = createTestTasks()
      const filters: FilterState = {
        ...EMPTY_FILTERS,
        project: 'agent-dashboard',
        agent: 'forge',
      }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Build dashboard UI')
    })

    it('combines project and priority filters', () => {
      const tasks = createTestTasks()
      const filters: FilterState = {
        ...EMPTY_FILTERS,
        project: 'agent-dashboard',
        priority: 'high',
      }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(2)
      expect(result.map((t) => t.title)).toEqual(
        expect.arrayContaining(['Build dashboard UI', 'Review PR #42'])
      )
    })

    it('combines agent and search filters', () => {
      const tasks = createTestTasks()
      const filters: FilterState = {
        ...EMPTY_FILTERS,
        agent: 'forge',
        search: 'deploy',
      }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Deploy staging environment')
    })

    it('combines all four filters', () => {
      const tasks = createTestTasks()
      const filters: FilterState = {
        project: 'agent-dashboard',
        agent: 'forge',
        priority: 'high',
        search: 'dashboard',
      }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Build dashboard UI')
    })

    it('returns empty when combined filters exclude everything', () => {
      const tasks = createTestTasks()
      const filters: FilterState = {
        project: 'agent-dashboard',
        agent: 'forge',
        priority: 'low',
        search: '',
      }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('does not mutate the original array', () => {
      const tasks = createTestTasks()
      const original = [...tasks]
      filterTasks(tasks, { ...EMPTY_FILTERS, project: 'agent-dashboard' })
      expect(tasks).toEqual(original)
    })

    it('handles empty string filter values as no filter', () => {
      const tasks = createTestTasks()
      const filters: FilterState = {
        project: '',
        agent: '',
        priority: '',
        search: '',
      }
      const result = filterTasks(tasks, filters)
      expect(result).toHaveLength(5)
    })
  })
})
