import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkloadChart, type WorkloadData } from '../../components/WorkloadChart'

// --- helpers -----------------------------------------------------------

function makeAgent(
  byStatus: Record<string, number>,
): { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> } {
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0)
  return { total, byStatus, byPriority: {} }
}

// --- Click-to-filter tests ---------------------------------------------

describe('WorkloadChart - Click-to-filter', () => {
  it('calls onAgentClick when an agent bar is clicked', () => {
    const onAgentClick = vi.fn()
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 3 }),
    }
    render(<WorkloadChart data={data} onAgentClick={onAgentClick} />)

    fireEvent.click(screen.getByTestId('workload-bar-forge'))
    expect(onAgentClick).toHaveBeenCalledTimes(1)
    expect(onAgentClick).toHaveBeenCalledWith('forge')
  })

  it('calls onAgentClick with the correct agent name for each bar', () => {
    const onAgentClick = vi.fn()
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 3 }),
      sentinel: makeAgent({ done: 2 }),
      oracle: makeAgent({ ready: 1 }),
    }
    render(<WorkloadChart data={data} onAgentClick={onAgentClick} />)

    fireEvent.click(screen.getByTestId('workload-bar-sentinel'))
    expect(onAgentClick).toHaveBeenCalledWith('sentinel')

    fireEvent.click(screen.getByTestId('workload-bar-oracle'))
    expect(onAgentClick).toHaveBeenCalledWith('oracle')
  })

  it('does not crash when onAgentClick is not provided', () => {
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 3 }),
    }
    render(<WorkloadChart data={data} />)

    // Should not throw
    fireEvent.click(screen.getByTestId('workload-bar-forge'))
  })

  it('agent bars have cursor-pointer style when onAgentClick is provided', () => {
    const onAgentClick = vi.fn()
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 2 }),
    }
    render(<WorkloadChart data={data} onAgentClick={onAgentClick} />)

    const bar = screen.getByTestId('workload-bar-forge')
    expect(bar.className).toContain('cursor-pointer')
  })

  it('agent bars do NOT have cursor-pointer when onAgentClick is not provided', () => {
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 2 }),
    }
    render(<WorkloadChart data={data} />)

    const bar = screen.getByTestId('workload-bar-forge')
    expect(bar.className).not.toContain('cursor-pointer')
  })

  it('agent bars have button role when clickable', () => {
    const onAgentClick = vi.fn()
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 2 }),
    }
    render(<WorkloadChart data={data} onAgentClick={onAgentClick} />)

    const bar = screen.getByTestId('workload-bar-forge')
    expect(bar.getAttribute('role')).toBe('button')
  })

  it('agent bars respond to keyboard Enter', () => {
    const onAgentClick = vi.fn()
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 2 }),
    }
    render(<WorkloadChart data={data} onAgentClick={onAgentClick} />)

    const bar = screen.getByTestId('workload-bar-forge')
    fireEvent.keyDown(bar, { key: 'Enter' })
    expect(onAgentClick).toHaveBeenCalledWith('forge')
  })

  it('agent bars respond to keyboard Space', () => {
    const onAgentClick = vi.fn()
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 2 }),
    }
    render(<WorkloadChart data={data} onAgentClick={onAgentClick} />)

    const bar = screen.getByTestId('workload-bar-forge')
    fireEvent.keyDown(bar, { key: ' ' })
    expect(onAgentClick).toHaveBeenCalledWith('forge')
  })
})

// --- Overload indicator tests ------------------------------------------

describe('WorkloadChart - Overload indicator enhanced UI', () => {
  it('shows overload badge with red background for 5+ in_progress', () => {
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 5 }),
    }
    render(<WorkloadChart data={data} />)

    const badge = screen.getByTestId('workload-overload-forge')
    expect(badge).toBeDefined()
    expect(badge.className).toContain('bg-red')
  })

  it('displays "Overloaded" text in the badge', () => {
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 6 }),
    }
    render(<WorkloadChart data={data} />)

    const badge = screen.getByTestId('workload-overload-forge')
    expect(badge.textContent).toContain('Overloaded')
  })

  it('overload badge has aria-label for accessibility', () => {
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 7 }),
    }
    render(<WorkloadChart data={data} />)

    const badge = screen.getByTestId('workload-overload-forge')
    expect(badge.getAttribute('aria-label')).toContain('overloaded')
  })

  it('shows ring highlight on the bar when overloaded', () => {
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 5, ready: 2 }),
    }
    render(<WorkloadChart data={data} />)

    const bar = screen.getByTestId('workload-bar-forge')
    // The bar container should have the ring class
    expect(bar.innerHTML).toContain('ring-2')
  })

  it('does NOT show ring highlight when not overloaded', () => {
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 4, ready: 2 }),
    }
    render(<WorkloadChart data={data} />)

    const bar = screen.getByTestId('workload-bar-forge')
    expect(bar.innerHTML).not.toContain('ring-2')
  })
})

// --- Integration: click-to-filter + overload together ------------------

describe('WorkloadChart - Integration', () => {
  it('clicking an overloaded agent bar triggers onAgentClick', () => {
    const onAgentClick = vi.fn()
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 6 }),
    }
    render(<WorkloadChart data={data} onAgentClick={onAgentClick} />)

    // Overload badge should be visible
    expect(screen.getByTestId('workload-overload-forge')).toBeDefined()

    // Clicking the bar should still trigger the callback
    fireEvent.click(screen.getByTestId('workload-bar-forge'))
    expect(onAgentClick).toHaveBeenCalledWith('forge')
  })

  it('clicking a non-overloaded agent bar triggers onAgentClick', () => {
    const onAgentClick = vi.fn()
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 6 }),
      sentinel: makeAgent({ in_progress: 2 }),
    }
    render(<WorkloadChart data={data} onAgentClick={onAgentClick} />)

    // Sentinel is not overloaded
    expect(screen.queryByTestId('workload-overload-sentinel')).toBeNull()

    fireEvent.click(screen.getByTestId('workload-bar-sentinel'))
    expect(onAgentClick).toHaveBeenCalledWith('sentinel')
  })

  it('renders multiple agents with mixed overload states and click handlers', () => {
    const onAgentClick = vi.fn()
    const data: WorkloadData = {
      forge: makeAgent({ in_progress: 5 }),
      sentinel: makeAgent({ in_progress: 3, done: 2 }),
      oracle: makeAgent({ in_progress: 7 }),
    }
    render(<WorkloadChart data={data} onAgentClick={onAgentClick} />)

    // forge and oracle are overloaded
    expect(screen.getByTestId('workload-overload-forge')).toBeDefined()
    expect(screen.getByTestId('workload-overload-oracle')).toBeDefined()
    // sentinel is not
    expect(screen.queryByTestId('workload-overload-sentinel')).toBeNull()

    // All bars are clickable
    fireEvent.click(screen.getByTestId('workload-bar-forge'))
    fireEvent.click(screen.getByTestId('workload-bar-sentinel'))
    fireEvent.click(screen.getByTestId('workload-bar-oracle'))
    expect(onAgentClick).toHaveBeenCalledTimes(3)
  })
})
