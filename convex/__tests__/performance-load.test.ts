import { describe, it, expect, vi } from 'vitest'
import type { Doc, Id } from '../_generated/dataModel'

vi.mock('../_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
}))

import * as taskModule from '../tasks'

type Task = Doc<'tasks'>
type TaskId = Id<'tasks'>

/** Typed helper to extract the handler function from a mocked Convex query config. */
function queryHandler(q: unknown): (ctx: any, args: any) => Promise<any> {
  return (q as { handler: (ctx: any, args: any) => Promise<any> }).handler
}

const getByStatusHandler = queryHandler(taskModule.getByStatus)

const QUERY_P95_THRESHOLD_MS = 500

function percentile(values: number[], targetPercentile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((targetPercentile / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

function makeTask(idx: number): Task {
  const statuses = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked'] as const
  const priorities = ['low', 'normal', 'high', 'urgent'] as const
  const status = statuses[idx % statuses.length]
  const priority = priorities[idx % priorities.length]

  return {
    _id: `j57perf${idx.toString().padStart(4, '0')}` as TaskId,
    _creationTime: Date.now() - idx,
    title: `Perf Task ${idx + 1}`,
    status,
    priority,
    assignedAgent: `agent-${idx % 8}`,
    createdBy: 'perf-test',
    createdAt: Date.now() - idx,
    project: 'agent-dashboard',
  } as Task
}

/**
 * Build a mock Convex ctx with 0 injected delay.
 * We measure only the real JS execution time of the handler — grouping 120 tasks
 * by status — without any artificial sleep that would make the test tautological.
 */
function mockCtx(tasks: Task[]) {
  return {
    db: {
      query: (_table: string) => ({
        order: (_dir: string) => ({
          take: async (n: number) => tasks.slice(0, n),
        }),
        withIndex: (_indexName: string, _indexFn?: (q: any) => any) => ({
          order: (_dir: string) => ({
            take: async (n: number) => tasks.slice(0, n),
          }),
        }),
      }),
    },
  }
}

describe('Convex query performance/load', () => {
  it('computes p50/p95 for getByStatus with 120 tasks and enforces latency threshold', async () => {
    const tasks = Array.from({ length: 120 }, (_, idx) => makeTask(idx))
    const ctx = mockCtx(tasks)
    const samples: number[] = []

    // 30 samples give a statistically meaningful p95 (vs 5 samples where p95 == max).
    for (let sampleIndex = 0; sampleIndex < 30; sampleIndex += 1) {
      const start = performance.now()
      const result = await getByStatusHandler(ctx, {})
      const elapsed = performance.now() - start

      const totalTasks =
        result.planning.length +
        result.ready.length +
        result.in_progress.length +
        result.in_review.length +
        result.done.length +
        result.blocked.length

      expect(totalTasks).toBe(120)
      samples.push(elapsed)
    }

    const p50 = percentile(samples, 50)
    const p95 = percentile(samples, 95)

    expect(p50).toBeLessThan(250)
    expect(
      p95,
      `Expected getByStatus p95 latency < ${QUERY_P95_THRESHOLD_MS}ms, got ${p95.toFixed(2)}ms`,
    ).toBeLessThan(QUERY_P95_THRESHOLD_MS)
  })
})
