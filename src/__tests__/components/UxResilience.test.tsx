/**
 * UX Resilience tests:
 * - ErrorBoundary renders fallback on error
 * - Skeleton renders with correct aria attributes
 * - EmptyState renders when data is empty
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// --- ErrorBoundary Tests ---

import { ErrorBoundary } from '../../components/ErrorBoundary'

function ThrowingComponent({ error }: { error: Error }): never {
  throw error
}

describe('ErrorBoundary', () => {
  // Suppress console.error from React error boundary logs in test output
  const originalConsoleError = console.error
  beforeEach(() => {
    console.error = vi.fn()
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeDefined()
  })

  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('kaboom')} />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('error-boundary-fallback')).toBeDefined()
    expect(screen.getByText('kaboom')).toBeDefined()
    expect(screen.getByRole('alert')).toBeDefined()
  })

  it('renders custom title in fallback', () => {
    render(
      <ErrorBoundary title="Custom error title">
        <ThrowingComponent error={new Error('fail')} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Custom error title')).toBeDefined()
  })

  it('renders inline variant when inline prop is set', () => {
    render(
      <ErrorBoundary inline>
        <ThrowingComponent error={new Error('inline error')} />
      </ErrorBoundary>,
    )
    const fallback = screen.getByTestId('error-boundary-fallback')
    expect(fallback).toBeDefined()
    expect(screen.getByText('inline error')).toBeDefined()
  })

  it('resets error state when retry button is clicked', () => {
    let shouldThrow = true
    function MaybeThrows() {
      if (shouldThrow) {
        throw new Error('recoverable')
      }
      return <p>Recovered</p>
    }

    render(
      <ErrorBoundary>
        <MaybeThrows />
      </ErrorBoundary>,
    )

    expect(screen.getByTestId('error-boundary-fallback')).toBeDefined()

    // Fix the error and retry
    shouldThrow = false
    fireEvent.click(screen.getByTestId('error-boundary-retry'))

    expect(screen.getByText('Recovered')).toBeDefined()
  })

  it('renders custom fallback via render prop', () => {
    render(
      <ErrorBoundary
        fallback={(error, reset) => (
          <div data-testid="custom-fallback">
            <span>{error.message}</span>
            <button onClick={reset}>Reset</button>
          </div>
        )}
      >
        <ThrowingComponent error={new Error('custom fallback error')} />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('custom-fallback')).toBeDefined()
    expect(screen.getByText('custom fallback error')).toBeDefined()
  })
})

// --- Skeleton Tests ---

import { Skeleton } from '../../components/ui/skeleton'
import { TaskCardSkeleton, KanbanColumnSkeleton, BoardSkeleton } from '../../components/skeletons'

describe('Skeleton', () => {
  it('renders with role="status"', () => {
    render(<Skeleton />)
    expect(screen.getByRole('status')).toBeDefined()
  })

  it('has aria-busy="true" attribute', () => {
    render(<Skeleton />)
    const el = screen.getByRole('status')
    expect(el.getAttribute('aria-busy')).toBe('true')
  })

  it('has aria-label="Loading" attribute', () => {
    render(<Skeleton />)
    const el = screen.getByRole('status')
    expect(el.getAttribute('aria-label')).toBe('Loading')
  })

  it('applies animate-pulse class', () => {
    render(<Skeleton />)
    const el = screen.getByRole('status')
    expect(el.className).toContain('animate-pulse')
  })

  it('merges custom className', () => {
    render(<Skeleton className="h-4 w-20" />)
    const el = screen.getByRole('status')
    expect(el.className).toContain('h-4')
    expect(el.className).toContain('w-20')
  })
})

describe('TaskCardSkeleton', () => {
  it('renders with data-testid', () => {
    render(<TaskCardSkeleton />)
    expect(screen.getByTestId('task-card-skeleton')).toBeDefined()
  })
})

describe('KanbanColumnSkeleton', () => {
  it('renders with data-testid', () => {
    render(<KanbanColumnSkeleton />)
    expect(screen.getByTestId('kanban-column-skeleton')).toBeDefined()
  })

  it('renders the specified number of task skeletons', () => {
    render(<KanbanColumnSkeleton taskCount={5} />)
    const skeletons = screen.getAllByTestId('task-card-skeleton')
    expect(skeletons).toHaveLength(5)
  })
})

describe('BoardSkeleton', () => {
  it('renders with data-testid', () => {
    render(<BoardSkeleton />)
    expect(screen.getByTestId('board-skeleton')).toBeDefined()
  })

  it('has aria-busy and aria-label for accessibility', () => {
    render(<BoardSkeleton />)
    const el = screen.getByTestId('board-skeleton')
    expect(el.getAttribute('aria-busy')).toBe('true')
    expect(el.getAttribute('aria-label')).toBe('Loading board')
  })
})

// --- EmptyState Tests ---

import { EmptyState } from '../../components/EmptyState'

describe('EmptyState', () => {
  it('renders no-data variant by default', () => {
    render(<EmptyState />)
    expect(screen.getByTestId('empty-state-no-data')).toBeDefined()
    expect(screen.getByText('No tasks yet')).toBeDefined()
    expect(screen.getByText('Tasks will appear here once they are created.')).toBeDefined()
  })

  it('renders no-results variant', () => {
    render(<EmptyState variant="no-results" />)
    expect(screen.getByTestId('empty-state-no-results')).toBeDefined()
    expect(screen.getByText('No results found')).toBeDefined()
    expect(screen.getByText('Try adjusting your filters or search query.')).toBeDefined()
  })

  it('renders custom title and description', () => {
    render(
      <EmptyState
        variant="no-data"
        title="Nothing here"
        description="Add some items to get started."
      />,
    )
    expect(screen.getByText('Nothing here')).toBeDefined()
    expect(screen.getByText('Add some items to get started.')).toBeDefined()
  })
})
