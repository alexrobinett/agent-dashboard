/**
 * useSearch Hook Tests
 * Task 4.1b: Text search + query param sync
 *
 * Tests for client-side search filtering of tasks by title and description.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSearch } from '../../hooks/useSearch'

// --- helpers -----------------------------------------------------------

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    _id: `t_${Math.random().toString(36).slice(2, 10)}`,
    title: 'Default Task',
    description: '',
    status: 'planning',
    priority: 'normal',
    assignedAgent: 'forge',
    project: 'agent-dashboard',
    ...overrides,
  }
}

const sampleTasks = [
  makeTask({ title: 'Plan API design', description: 'Design the REST API endpoints' }),
  makeTask({ title: 'Implement auth flow', description: 'Add OAuth2 authentication' }),
  makeTask({ title: 'Fix broken pipeline', description: 'CI pipeline is failing on deploy' }),
  makeTask({ title: 'Write unit tests', description: 'Cover critical paths with tests' }),
  makeTask({ title: 'Update documentation', description: 'Refresh the API docs' }),
]

// --- tests -------------------------------------------------------------

describe('useSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Basic filtering', () => {
    it('returns all tasks when search query is empty', () => {
      const { result } = renderHook(() => useSearch(sampleTasks, ''))

      expect(result.current.filteredTasks).toHaveLength(5)
      expect(result.current.isSearching).toBe(false)
    })

    it('filters tasks by title match (case-insensitive)', () => {
      const { result } = renderHook(() => useSearch(sampleTasks, 'plan'))

      // Wait for debounce
      act(() => { vi.advanceTimersByTime(300) })

      const titles = result.current.filteredTasks.map((t: any) => t.title)
      expect(titles).toContain('Plan API design')
      expect(result.current.filteredTasks.length).toBeGreaterThanOrEqual(1)
    })

    it('filters tasks by description match (case-insensitive)', () => {
      const { result } = renderHook(() => useSearch(sampleTasks, 'oauth'))

      act(() => { vi.advanceTimersByTime(300) })

      expect(result.current.filteredTasks).toHaveLength(1)
      expect(result.current.filteredTasks[0].title).toBe('Implement auth flow')
    })

    it('matches across both title and description', () => {
      const { result } = renderHook(() => useSearch(sampleTasks, 'api'))

      act(() => { vi.advanceTimersByTime(300) })

      const titles = result.current.filteredTasks.map((t: any) => t.title).sort()
      // "Plan API design" matches title, "Update documentation" matches description ("API docs")
      expect(titles).toContain('Plan API design')
      expect(titles).toContain('Update documentation')
    })

    it('is case-insensitive for both title and description', () => {
      const { result } = renderHook(() => useSearch(sampleTasks, 'PIPELINE'))

      act(() => { vi.advanceTimersByTime(300) })

      expect(result.current.filteredTasks).toHaveLength(1)
      expect(result.current.filteredTasks[0].title).toBe('Fix broken pipeline')
    })

    it('returns empty array when no tasks match', () => {
      const { result } = renderHook(() => useSearch(sampleTasks, 'zzzznotfound'))

      act(() => { vi.advanceTimersByTime(300) })

      expect(result.current.filteredTasks).toHaveLength(0)
    })

    it('handles tasks with missing description gracefully', () => {
      const tasks = [
        makeTask({ title: 'No description task' }),
        makeTask({ title: 'Another task', description: undefined }),
        makeTask({ title: 'Has description', description: 'Some text' }),
      ]

      const { result } = renderHook(() => useSearch(tasks, 'no description'))

      act(() => { vi.advanceTimersByTime(300) })

      expect(result.current.filteredTasks).toHaveLength(1)
      expect(result.current.filteredTasks[0].title).toBe('No description task')
    })
  })

  describe('Debounce behavior', () => {
    it('does not filter immediately - waits for debounce', () => {
      const { result } = renderHook(() => useSearch(sampleTasks, 'plan'))

      // Before debounce completes, should still return all tasks
      expect(result.current.filteredTasks).toHaveLength(5)
      expect(result.current.isSearching).toBe(true)

      // After debounce
      act(() => { vi.advanceTimersByTime(300) })

      expect(result.current.filteredTasks.length).toBeLessThan(5)
      expect(result.current.isSearching).toBe(false)
    })

    it('resets debounce on rapid input changes', () => {
      const { result, rerender } = renderHook(
        ({ query }) => useSearch(sampleTasks, query),
        { initialProps: { query: 'p' } }
      )

      // Type more characters before debounce completes
      act(() => { vi.advanceTimersByTime(100) })
      rerender({ query: 'pl' })

      act(() => { vi.advanceTimersByTime(100) })
      rerender({ query: 'pla' })

      act(() => { vi.advanceTimersByTime(100) })
      rerender({ query: 'plan' })

      // Should still be searching since debounce keeps resetting
      expect(result.current.isSearching).toBe(true)

      // Complete debounce from last input
      act(() => { vi.advanceTimersByTime(300) })

      expect(result.current.isSearching).toBe(false)
      const titles = result.current.filteredTasks.map((t: any) => t.title)
      expect(titles).toContain('Plan API design')
    })

    it('shows isSearching=true during debounce period', () => {
      const { result } = renderHook(() => useSearch(sampleTasks, 'auth'))

      expect(result.current.isSearching).toBe(true)

      act(() => { vi.advanceTimersByTime(300) })

      expect(result.current.isSearching).toBe(false)
    })

    it('does not debounce when clearing search', () => {
      const { result, rerender } = renderHook(
        ({ query }) => useSearch(sampleTasks, query),
        { initialProps: { query: 'auth' } }
      )

      act(() => { vi.advanceTimersByTime(300) })
      expect(result.current.filteredTasks).toHaveLength(1)

      // Clear search - should immediately return all tasks
      rerender({ query: '' })

      expect(result.current.filteredTasks).toHaveLength(5)
      expect(result.current.isSearching).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('handles empty tasks array', () => {
      const { result } = renderHook(() => useSearch([], 'anything'))

      act(() => { vi.advanceTimersByTime(300) })

      expect(result.current.filteredTasks).toHaveLength(0)
    })

    it('handles whitespace-only search query', () => {
      const { result } = renderHook(() => useSearch(sampleTasks, '   '))

      expect(result.current.filteredTasks).toHaveLength(5)
      expect(result.current.isSearching).toBe(false)
    })

    it('trims search query before matching', () => {
      const { result } = renderHook(() => useSearch(sampleTasks, '  plan  '))

      act(() => { vi.advanceTimersByTime(300) })

      const titles = result.current.filteredTasks.map((t: any) => t.title)
      expect(titles).toContain('Plan API design')
    })

    it('updates filtered results when tasks array changes', () => {
      const { result, rerender } = renderHook(
        ({ tasks, query }) => useSearch(tasks, query),
        { initialProps: { tasks: sampleTasks, query: 'plan' } }
      )

      act(() => { vi.advanceTimersByTime(300) })

      const initialCount = result.current.filteredTasks.length

      // Add a new task that matches the search
      const updatedTasks = [
        ...sampleTasks,
        makeTask({ title: 'Plan database migration', description: 'Migrate schema' }),
      ]
      rerender({ tasks: updatedTasks, query: 'plan' })

      act(() => { vi.advanceTimersByTime(300) })

      expect(result.current.filteredTasks.length).toBe(initialCount + 1)
    })

    it('handles special regex characters in search query', () => {
      const tasks = [
        makeTask({ title: 'Fix bug (critical)', description: 'Must fix ASAP' }),
        makeTask({ title: 'Normal task', description: 'Nothing special' }),
      ]

      const { result } = renderHook(() => useSearch(tasks, '(critical)'))

      act(() => { vi.advanceTimersByTime(300) })

      expect(result.current.filteredTasks).toHaveLength(1)
      expect(result.current.filteredTasks[0].title).toBe('Fix bug (critical)')
    })

    it('matches by friendly task key', () => {
      const tasks = [
        makeTask({ title: 'Task A', taskKey: 'AD-101' }),
        makeTask({ title: 'Task B', taskKey: 'AD-202' }),
      ]

      const { result } = renderHook(() => useSearch(tasks, 'ad-202'))
      act(() => { vi.advanceTimersByTime(300) })

      expect(result.current.filteredTasks).toHaveLength(1)
      expect((result.current.filteredTasks[0] as any).taskKey).toBe('AD-202')
    })

    it('matches by convex _id', () => {
      const tasks = [
        makeTask({ _id: 'j57abc123xyz' }),
        makeTask({ _id: 'j57def456uvw' }),
      ]

      const { result } = renderHook(() => useSearch(tasks, 'j57def'))
      act(() => { vi.advanceTimersByTime(300) })

      expect(result.current.filteredTasks).toHaveLength(1)
      expect((result.current.filteredTasks[0] as any)._id).toBe('j57def456uvw')
    })
  })
})
