/**
 * UX Resilience tests:
 * - ErrorBoundary renders fallback on error
 * - Skeleton renders with correct aria attributes
 * - EmptyState renders when data is empty
 * - NetworkStatusBanner shows/hides based on WebSocket state
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
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent error={new Error('kaboom')} />
      </ErrorBoundary>,
    )
    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument()
    expect(screen.getByText('kaboom')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders custom title in fallback', () => {
    render(
      <ErrorBoundary title="Custom error title">
        <ThrowingComponent error={new Error('fail')} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Custom error title')).toBeInTheDocument()
  })

  it('renders inline variant when inline prop is set', () => {
    render(
      <ErrorBoundary inline>
        <ThrowingComponent error={new Error('inline error')} />
      </ErrorBoundary>,
    )
    const fallback = screen.getByTestId('error-boundary-fallback')
    expect(fallback).toBeInTheDocument()
    expect(screen.getByText('inline error')).toBeInTheDocument()
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

    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument()

    // Fix the error and retry
    shouldThrow = false
    fireEvent.click(screen.getByTestId('error-boundary-retry'))

    expect(screen.getByText('Recovered')).toBeInTheDocument()
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
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
    expect(screen.getByText('custom fallback error')).toBeInTheDocument()
  })
})

// --- Skeleton Tests ---

import { Skeleton } from '../../components/ui/skeleton'
import { TaskCardSkeleton, KanbanColumnSkeleton, BoardSkeleton } from '../../components/skeletons'

describe('Skeleton', () => {
  it('renders with role="status"', () => {
    render(<Skeleton />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('has aria-busy="true" attribute', () => {
    render(<Skeleton />)
    const el = screen.getByRole('status')
    expect(el).toHaveAttribute('aria-busy', 'true')
  })

  it('has aria-label="Loading" attribute', () => {
    render(<Skeleton />)
    const el = screen.getByRole('status')
    expect(el).toHaveAttribute('aria-label', 'Loading')
  })

  it('applies animate-pulse class', () => {
    render(<Skeleton />)
    const el = screen.getByRole('status')
    expect(el).toHaveClass('animate-pulse')
  })

  it('merges custom className', () => {
    render(<Skeleton className="h-4 w-20" />)
    const el = screen.getByRole('status')
    expect(el).toHaveClass('h-4', 'w-20')
  })
})

describe('TaskCardSkeleton', () => {
  it('renders with data-testid', () => {
    render(<TaskCardSkeleton />)
    expect(screen.getByTestId('task-card-skeleton')).toBeInTheDocument()
  })
})

describe('KanbanColumnSkeleton', () => {
  it('renders with data-testid', () => {
    render(<KanbanColumnSkeleton />)
    expect(screen.getByTestId('kanban-column-skeleton')).toBeInTheDocument()
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
    expect(screen.getByTestId('board-skeleton')).toBeInTheDocument()
  })

  it('has aria-busy and aria-label for accessibility', () => {
    render(<BoardSkeleton />)
    const el = screen.getByTestId('board-skeleton')
    expect(el).toHaveAttribute('aria-busy', 'true')
    expect(el).toHaveAttribute('aria-label', 'Loading board')
  })
})

// --- EmptyState Tests ---

import { EmptyState } from '../../components/EmptyState'

describe('EmptyState', () => {
  it('renders no-data variant by default', () => {
    render(<EmptyState />)
    expect(screen.getByTestId('empty-state-no-data')).toBeInTheDocument()
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
    expect(screen.getByText('Tasks will appear here once they are created.')).toBeInTheDocument()
  })

  it('renders no-results variant', () => {
    render(<EmptyState variant="no-results" />)
    expect(screen.getByTestId('empty-state-no-results')).toBeInTheDocument()
    expect(screen.getByText('No results found')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your filters or search query.')).toBeInTheDocument()
  })

  it('renders custom title and description', () => {
    render(
      <EmptyState
        variant="no-data"
        title="Nothing here"
        description="Add some items to get started."
      />,
    )
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.getByText('Add some items to get started.')).toBeInTheDocument()
  })
})

// --- NetworkStatusBanner Tests ---

import { NetworkStatusBanner } from '../../components/NetworkStatusBanner'

// Mock the convex hook
vi.mock('convex/react', () => ({
  useConvexConnectionState: vi.fn(),
}))

import { useConvexConnectionState } from 'convex/react'

const mockUseConvexConnectionState = useConvexConnectionState as ReturnType<typeof vi.fn>

describe('NetworkStatusBanner', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when WebSocket is connected', () => {
    mockUseConvexConnectionState.mockReturnValue({ isWebSocketConnected: true })
    const { container } = render(<NetworkStatusBanner />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('network-status-banner')).not.toBeInTheDocument()
  })

  it('renders the banner when WebSocket is disconnected', () => {
    mockUseConvexConnectionState.mockReturnValue({ isWebSocketConnected: false })
    render(<NetworkStatusBanner />)
    expect(screen.getByTestId('network-status-banner')).toBeInTheDocument()
  })

  it('banner has role="alert" for accessibility', () => {
    mockUseConvexConnectionState.mockReturnValue({ isWebSocketConnected: false })
    render(<NetworkStatusBanner />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('banner displays reconnecting message', () => {
    mockUseConvexConnectionState.mockReturnValue({ isWebSocketConnected: false })
    render(<NetworkStatusBanner />)
    expect(screen.getByText('Reconnecting — live updates paused')).toBeInTheDocument()
  })
})
