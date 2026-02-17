import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { WorkloadChart, type WorkloadData } from '../../components/WorkloadChart'

// --- helpers -----------------------------------------------------------

function renderChart(data: WorkloadData = {}) {
  return render(<WorkloadChart data={data} />)
}

function makeAgent(
  byStatus: Record<string, number>,
): { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> } {
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0)
  return { total, byStatus, byPriority: {} }
}

// --- tests -------------------------------------------------------------

describe('WorkloadChart', () => {
  describe('Empty state', () => {
    it('renders empty state message when no data', () => {
      renderChart({})
      expect(screen.getByTestId('workload-chart-empty')).toBeDefined()
      expect(screen.getByText('No workload data')).toBeDefined()
    })

    it('renders the chart container', () => {
      renderChart({})
      expect(screen.getByTestId('workload-chart')).toBeDefined()
    })
  })

  describe('Agent bars', () => {
    it('renders correct number of agent bars', () => {
      const data: WorkloadData = {
        forge: makeAgent({ in_progress: 2, ready: 1 }),
        sentinel: makeAgent({ done: 3 }),
        oracle: makeAgent({ blocked: 1 }),
      }
      renderChart(data)
      const bars = screen.getAllByTestId(/^workload-bar-/)
      expect(bars).toHaveLength(3)
    })

    it('renders a single agent correctly', () => {
      const data: WorkloadData = {
        forge: makeAgent({ in_progress: 2 }),
      }
      renderChart(data)
      expect(screen.getByTestId('workload-bar-forge')).toBeDefined()
      expect(screen.getByText('forge')).toBeDefined()
      expect(screen.getByText('2')).toBeDefined()
    })

    it('sorts agents by total task count descending', () => {
      const data: WorkloadData = {
        oracle: makeAgent({ ready: 1 }),
        forge: makeAgent({ in_progress: 5, ready: 3 }),
        sentinel: makeAgent({ done: 3, in_review: 1 }),
      }
      renderChart(data)
      const bars = screen.getAllByTestId(/^workload-bar-/)
      expect(bars[0].getAttribute('data-testid')).toBe('workload-bar-forge')
      expect(bars[1].getAttribute('data-testid')).toBe('workload-bar-sentinel')
      expect(bars[2].getAttribute('data-testid')).toBe('workload-bar-oracle')
    })
  })

  describe('Status segments', () => {
    it('renders status segments with correct proportional widths', () => {
      const data: WorkloadData = {
        forge: makeAgent({ ready: 2, in_progress: 3 }),
      }
      renderChart(data)
      const bar = screen.getByTestId('workload-bar-forge')
      const segments = within(bar).getAllByTestId(/^workload-segment-/)
      // ready: 2/5 = 40%, in_progress: 3/5 = 60%
      const readySegment = segments.find(
        (s) => s.getAttribute('data-testid') === 'workload-segment-forge-ready',
      )
      const inProgressSegment = segments.find(
        (s) => s.getAttribute('data-testid') === 'workload-segment-forge-in_progress',
      )
      expect(readySegment).toBeDefined()
      expect(inProgressSegment).toBeDefined()
      expect(readySegment!.style.width).toBe('40%')
      expect(inProgressSegment!.style.width).toBe('60%')
    })

    it('renders only statuses that have tasks', () => {
      const data: WorkloadData = {
        forge: makeAgent({ done: 5 }),
      }
      renderChart(data)
      const bar = screen.getByTestId('workload-bar-forge')
      const segments = within(bar).getAllByTestId(/^workload-segment-/)
      expect(segments).toHaveLength(1)
      expect(segments[0].getAttribute('data-testid')).toBe('workload-segment-forge-done')
    })
  })

  describe('Color coding', () => {
    it('uses blue for ready status', () => {
      const data: WorkloadData = { forge: makeAgent({ ready: 1 }) }
      renderChart(data)
      const segment = screen.getByTestId('workload-segment-forge-ready')
      expect(segment.style.backgroundColor).toBe('rgb(59, 130, 246)')
    })

    it('uses amber for in_progress status', () => {
      const data: WorkloadData = { forge: makeAgent({ in_progress: 1 }) }
      renderChart(data)
      const segment = screen.getByTestId('workload-segment-forge-in_progress')
      expect(segment.style.backgroundColor).toBe('rgb(245, 158, 11)')
    })

    it('uses purple for in_review status', () => {
      const data: WorkloadData = { forge: makeAgent({ in_review: 1 }) }
      renderChart(data)
      const segment = screen.getByTestId('workload-segment-forge-in_review')
      expect(segment.style.backgroundColor).toBe('rgb(168, 85, 247)')
    })

    it('uses red for blocked status', () => {
      const data: WorkloadData = { forge: makeAgent({ blocked: 1 }) }
      renderChart(data)
      const segment = screen.getByTestId('workload-segment-forge-blocked')
      expect(segment.style.backgroundColor).toBe('rgb(239, 68, 68)')
    })

    it('uses green for done status', () => {
      const data: WorkloadData = { forge: makeAgent({ done: 1 }) }
      renderChart(data)
      const segment = screen.getByTestId('workload-segment-forge-done')
      expect(segment.style.backgroundColor).toBe('rgb(34, 197, 94)')
    })

    it('uses gray for cancelled status', () => {
      const data: WorkloadData = { forge: makeAgent({ cancelled: 1 }) }
      renderChart(data)
      const segment = screen.getByTestId('workload-segment-forge-cancelled')
      expect(segment.style.backgroundColor).toBe('rgb(107, 114, 128)')
    })
  })

  describe('Overload indicator', () => {
    it('shows overload indicator when agent has 5+ in_progress tasks', () => {
      const data: WorkloadData = {
        forge: makeAgent({ in_progress: 5 }),
      }
      renderChart(data)
      expect(screen.getByTestId('workload-overload-forge')).toBeDefined()
    })

    it('shows overload indicator when agent has more than 5 in_progress tasks', () => {
      const data: WorkloadData = {
        forge: makeAgent({ in_progress: 8 }),
      }
      renderChart(data)
      expect(screen.getByTestId('workload-overload-forge')).toBeDefined()
    })

    it('does NOT show overload indicator when agent has 4 in_progress tasks', () => {
      const data: WorkloadData = {
        forge: makeAgent({ in_progress: 4 }),
      }
      renderChart(data)
      expect(screen.queryByTestId('workload-overload-forge')).toBeNull()
    })

    it('does NOT show overload indicator when agent has 0 in_progress tasks', () => {
      const data: WorkloadData = {
        forge: makeAgent({ done: 10 }),
      }
      renderChart(data)
      expect(screen.queryByTestId('workload-overload-forge')).toBeNull()
    })

    it('only shows overload on agents that qualify', () => {
      const data: WorkloadData = {
        forge: makeAgent({ in_progress: 6 }),
        sentinel: makeAgent({ in_progress: 3 }),
      }
      renderChart(data)
      expect(screen.getByTestId('workload-overload-forge')).toBeDefined()
      expect(screen.queryByTestId('workload-overload-sentinel')).toBeNull()
    })
  })

  describe('Accessibility', () => {
    it('has aria-label on the chart container', () => {
      renderChart({})
      expect(screen.getByLabelText('Agent workload chart')).toBeDefined()
    })

    it('has aria-label on each agent bar', () => {
      const data: WorkloadData = {
        forge: makeAgent({ in_progress: 2, ready: 1 }),
      }
      renderChart(data)
      expect(screen.getByLabelText('forge: 3 tasks')).toBeDefined()
    })

    it('has aria-label on each status segment', () => {
      const data: WorkloadData = {
        forge: makeAgent({ in_progress: 2, ready: 1 }),
      }
      renderChart(data)
      expect(screen.getByLabelText('ready: 1')).toBeDefined()
      expect(screen.getByLabelText('in_progress: 2')).toBeDefined()
    })
  })
})
