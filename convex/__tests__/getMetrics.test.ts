import { describe, it, expect, vi } from 'vitest'

vi.mock('../_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
  internalMutation: (config: Record<string, unknown>) => config,
}))

import * as taskModule from '../tasks'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerExtractor = { handler: (...args: any[]) => Promise<any> }
const getMetricsHandler = (taskModule.getMetrics as unknown as HandlerExtractor).handler

const DAY_MS = 24 * 60 * 60 * 1000
const NOW = Date.now()

function makeCtx(tasks: Array<Record<string, unknown>>) {
  return {
    db: {
      query: (_table: string) => ({
        order: (_dir: string) => ({
          take: async (n: number) => tasks.slice(0, n),
          paginate: async ({ numItems, cursor }: { numItems: number; cursor: string | null }) => {
            const offset = cursor ? Number.parseInt(cursor, 10) : 0
            const page = tasks.slice(offset, offset + numItems)
            return { page, continueCursor: String(offset + page.length), isDone: page.length < numItems }
          },
        }),
      }),
    },
  }
}

describe('getMetrics query', () => {
  it('returns correct shape for empty dataset', async () => {
    const ctx = makeCtx([])
    const result = await getMetricsHandler(ctx, { timeframe: 'day' })
    expect(result).toMatchObject({
      totalTasks: expect.any(Number),
      completedTasks: expect.any(Number),
      activeAgents: expect.any(Number),
      avgCompletionMs: expect.any(Number),
    })
  })

  it('returns correct shape for timeframe "day"', async () => {
    const tasks = [
      { _id: 'a', title: 'T1', status: 'in_progress', assignedAgent: 'forge', createdAt: NOW - DAY_MS / 2 },
      { _id: 'b', title: 'T2', status: 'done', assignedAgent: 'shield', createdAt: NOW - DAY_MS / 2, startedAt: NOW - 1000, completedAt: NOW - 500 },
    ]
    const ctx = makeCtx(tasks)
    const result = await getMetricsHandler(ctx, { timeframe: 'day' })
    expect(result).toMatchObject({
      totalTasks: 2,
      completedTasks: 1,
      activeAgents: 1,
      avgCompletionMs: 500,
    })
  })

  it('returns correct shape for timeframe "week"', async () => {
    const tasks = [
      { _id: 'a', status: 'done', assignedAgent: 'forge', createdAt: NOW - 3 * DAY_MS, startedAt: NOW - 2 * DAY_MS, completedAt: NOW - DAY_MS },
      { _id: 'b', status: 'in_progress', assignedAgent: 'forge', createdAt: NOW - 2 * DAY_MS },
    ]
    const ctx = makeCtx(tasks)
    const result = await getMetricsHandler(ctx, { timeframe: 'week' })
    expect(result).toMatchObject({
      totalTasks: 2,
      completedTasks: 1,
      activeAgents: 1,
    })
    expect(result.avgCompletionMs).toBeGreaterThan(0)
  })

  it('returns correct shape for timeframe "month"', async () => {
    const tasks = [
      { _id: 'a', status: 'done', assignedAgent: 'forge', createdAt: NOW - 20 * DAY_MS },
      { _id: 'b', status: 'done', assignedAgent: 'shield', createdAt: NOW - 15 * DAY_MS },
      { _id: 'c', status: 'in_progress', assignedAgent: 'jarvis', createdAt: NOW - 5 * DAY_MS },
    ]
    const ctx = makeCtx(tasks)
    const result = await getMetricsHandler(ctx, { timeframe: 'month' })
    expect(result).toMatchObject({
      totalTasks: 3,
      completedTasks: 2,
      activeAgents: 1,
      avgCompletionMs: 0, // no startedAt/completedAt set
    })
  })

  it('excludes tasks outside the timeframe', async () => {
    const tasks = [
      // way outside week window
      { _id: 'old', status: 'done', assignedAgent: 'forge', createdAt: NOW - 60 * DAY_MS },
      // within week window
      { _id: 'recent', status: 'in_progress', assignedAgent: 'shield', createdAt: NOW - 2 * DAY_MS },
    ]
    const ctx = makeCtx(tasks)
    const result = await getMetricsHandler(ctx, { timeframe: 'week' })
    expect(result.totalTasks).toBe(1)
    expect(result.activeAgents).toBe(1)
  })

  it('calculates avgCompletionMs correctly across multiple done tasks', async () => {
    const tasks = [
      { _id: 'a', status: 'done', createdAt: NOW - DAY_MS, startedAt: NOW - 1000, completedAt: NOW - 500 },
      { _id: 'b', status: 'done', createdAt: NOW - DAY_MS, startedAt: NOW - 2000, completedAt: NOW - 500 },
    ]
    const ctx = makeCtx(tasks)
    const result = await getMetricsHandler(ctx, { timeframe: 'week' })
    // avg of 500ms and 1500ms = 1000ms
    expect(result.avgCompletionMs).toBe(1000)
  })
})
