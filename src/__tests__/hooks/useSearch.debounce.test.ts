import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSearch } from '../../hooks/useSearch'

const tasks = [
  { _id: '1', title: 'Fix authentication bug', description: 'Auth flows' },
  { _id: '2', title: 'Update dashboard layout', description: 'UI improvements' },
  { _id: '3', title: 'Refactor data layer', description: 'Performance work' },
]

describe('useSearch debounce behaviour', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns all tasks when query is empty', () => {
    const { result } = renderHook(() => useSearch(tasks, ''))
    expect(result.current.filteredTasks).toHaveLength(3)
    expect(result.current.isSearching).toBe(false)
  })

  it('sets isSearching=true immediately when query is typed (before debounce fires)', () => {
    const { result } = renderHook(() => useSearch(tasks, 'auth'))
    // Before 300ms, debouncedQuery hasn't updated yet → isSearching should be true
    expect(result.current.isSearching).toBe(true)
  })

  it('filters tasks correctly after debounce period (300ms)', () => {
    const { result } = renderHook(() => useSearch(tasks, 'auth'))

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.isSearching).toBe(false)
    expect(result.current.filteredTasks).toHaveLength(1)
    expect(result.current.filteredTasks[0]._id).toBe('1')
  })

  it('does NOT filter before debounce period elapses', () => {
    const { result } = renderHook(() => useSearch(tasks, 'dashboard'))

    // Only 100ms → debounce hasn't fired
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // filteredTasks returns all tasks until debouncedQuery is set
    expect(result.current.filteredTasks).toHaveLength(3)
    expect(result.current.isSearching).toBe(true)
  })

  it('filters with the correct query arg after debounce period', () => {
    const { result } = renderHook(() => useSearch(tasks, 'data layer'))

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.filteredTasks).toHaveLength(1)
    expect(result.current.filteredTasks[0]._id).toBe('3')
  })

  it('clears instantly (0ms debounce) when query is reset to empty', () => {
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useSearch(tasks, q),
      { initialProps: { q: 'auth' } },
    )

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(result.current.filteredTasks).toHaveLength(1)

    rerender({ q: '' })

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(result.current.filteredTasks).toHaveLength(3)
    expect(result.current.isSearching).toBe(false)
  })
})
