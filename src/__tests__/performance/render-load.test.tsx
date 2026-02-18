import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { KanbanBoard } from '../../components/KanbanBoard'
import { createMockTasksByStatus, groupTasksByStatus } from '../../test/fixtures'

const RENDER_THRESHOLD_MS = 2000

vi.mock('../../hooks/useOptimisticTaskMove', () => ({
  useOptimisticTaskMove: (tasks: Record<string, unknown[]>) => ({
    displayTasks: tasks,
    moveTask: vi.fn(),
  }),
}))

function percentile(values: number[], targetPercentile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((targetPercentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

describe('Dashboard UI render performance/load', () => {
  it('renders 120 task cards with p95 interactive render time under 2s', async () => {
    const samples: number[] = []

    // 20 samples minimum for a statistically valid p95 (5 samples ≡ max, not p95).
    for (let sampleIndex = 0; sampleIndex < 20; sampleIndex += 1) {
      const tasks = createMockTasksByStatus(20)
      const groupedTasks = groupTasksByStatus(tasks)

      const start = performance.now()
      const view = render(<KanbanBoard tasks={groupedTasks} />)

      const planningHeading = await view.findByRole('heading', { name: /^planning$/i }, { timeout: 2000 })
      const taskCards = await view.findAllByTestId(/task-card-/, {}, { timeout: 2000 })

      expect(planningHeading).toBeTruthy()
      expect(taskCards.length).toBe(120)

      samples.push(performance.now() - start)
      view.unmount()
    }

    const p50 = percentile(samples, 50)
    const p95 = percentile(samples, 95)

    expect(p50).toBeLessThan(1200)
    expect(
      p95,
      `Expected render p95 < ${RENDER_THRESHOLD_MS}ms, got ${p95.toFixed(2)}ms`,
    ).toBeLessThan(RENDER_THRESHOLD_MS)
  })
})
