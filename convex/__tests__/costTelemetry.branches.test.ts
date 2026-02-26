import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Doc, Id } from '../_generated/dataModel'

vi.mock('../_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
}))

import * as costTelemetryModule from '../costTelemetry'

type CostTelemetryDoc = Doc<'costTelemetry'>
type CostTelemetryId = Id<'costTelemetry'>
type TaskId = Id<'tasks'>
type CostTelemetryFields = Omit<CostTelemetryDoc, '_id' | '_creationTime'>

type HandlerConfig<TArgs, TResult> = {
  handler: (ctx: MockRecordCtx, args: TArgs) => Promise<TResult>
}

const recordHandler = (
  costTelemetryModule.record as unknown as HandlerConfig<
    {
      taskId: TaskId
      agent: string
      model: string
      inputTokens: number
      outputTokens: number
      estimatedCostUsd: number
      timestamp?: number
      runId?: string
      sessionKey?: string
    },
    { id: CostTelemetryId }
  >
).handler

type MockRecordCtx = {
  db: {
    insert: (table: 'costTelemetry', doc: CostTelemetryFields) => Promise<CostTelemetryId>
  }
  auth: { getUserIdentity: () => Promise<{ tokenIdentifier: string; subject: string; issuer: string } | null> }
  _docs: CostTelemetryDoc[]
}

function makeTelemetry(overrides: Partial<CostTelemetryFields> & { _id: CostTelemetryId }): CostTelemetryDoc {
  const { _id, ...rest } = overrides
  return {
    _id,
    _creationTime: Date.now(),
    taskId: 'task-1' as TaskId,
    agent: 'forge',
    model: 'gpt-5',
    inputTokens: 100,
    outputTokens: 50,
    estimatedCostUsd: 0.1234,
    timestamp: Date.now(),
    ...rest,
  }
}

function makeRecordCtx(authed = true): MockRecordCtx {
  const docs: CostTelemetryDoc[] = []
  let idCounter = 1
  return {
    db: {
      insert: async (_table: 'costTelemetry', doc: CostTelemetryFields) => {
        const id = `ct-${idCounter++}` as CostTelemetryId
        docs.push({ _id: id, _creationTime: Date.now(), ...doc })
        return id
      },
    },
    auth: {
      getUserIdentity: async () =>
        authed ? { tokenIdentifier: 'test|user', subject: 'test-user', issuer: 'test' } : null,
    },
    _docs: docs,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ──────────────────────────────────────────────────────────────────────────────
// requireNonEmptyTrimmed branches
// ──────────────────────────────────────────────────────────────────────────────
describe('requireNonEmptyTrimmed branches via record', () => {
  it('throws when agent is empty/whitespace', async () => {
    const ctx = makeRecordCtx()
    await expect(recordHandler(ctx, {
      taskId: 'task-1' as TaskId,
      agent: '   ',
      model: 'gpt-5',
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUsd: 0.1,
    })).rejects.toThrow('agent must be a non-empty string')
  })

  it('throws when agent exceeds 80 characters', async () => {
    const ctx = makeRecordCtx()
    await expect(recordHandler(ctx, {
      taskId: 'task-1' as TaskId,
      agent: 'a'.repeat(81),
      model: 'gpt-5',
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUsd: 0.1,
    })).rejects.toThrow('agent must be <= 80 characters')
  })

  it('throws when model is empty', async () => {
    const ctx = makeRecordCtx()
    await expect(recordHandler(ctx, {
      taskId: 'task-1' as TaskId,
      agent: 'forge',
      model: '',
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUsd: 0.1,
    })).rejects.toThrow('model must be a non-empty string')
  })

  it('throws when model exceeds 120 characters', async () => {
    const ctx = makeRecordCtx()
    await expect(recordHandler(ctx, {
      taskId: 'task-1' as TaskId,
      agent: 'forge',
      model: 'm'.repeat(121),
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUsd: 0.1,
    })).rejects.toThrow('model must be <= 120 characters')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// requireNonNegativeFinite + requireNonNegativeInteger NaN / Infinity branches
// ──────────────────────────────────────────────────────────────────────────────
describe('NaN / Infinity validation branches via record', () => {
  it('throws when estimatedCostUsd is NaN', async () => {
    const ctx = makeRecordCtx()
    await expect(recordHandler(ctx, {
      taskId: 'task-1' as TaskId,
      agent: 'forge',
      model: 'gpt-5',
      inputTokens: 1,
      outputTokens: 1,
      estimatedCostUsd: NaN,
    })).rejects.toThrow('estimatedCostUsd must be a non-negative number')
  })

  it('throws when inputTokens is NaN', async () => {
    const ctx = makeRecordCtx()
    await expect(recordHandler(ctx, {
      taskId: 'task-1' as TaskId,
      agent: 'forge',
      model: 'gpt-5',
      inputTokens: NaN,
      outputTokens: 1,
      estimatedCostUsd: 0.1,
    })).rejects.toThrow('inputTokens must be a non-negative integer')
  })

  it('throws when inputTokens is Infinity', async () => {
    const ctx = makeRecordCtx()
    await expect(recordHandler(ctx, {
      taskId: 'task-1' as TaskId,
      agent: 'forge',
      model: 'gpt-5',
      inputTokens: Infinity,
      outputTokens: 1,
      estimatedCostUsd: 0.1,
    })).rejects.toThrow('inputTokens must be a non-negative integer')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// record mutation — unauthenticated branch
// ──────────────────────────────────────────────────────────────────────────────
describe('record mutation unauthenticated', () => {
  it('throws Unauthenticated when getUserIdentity returns null', async () => {
    const ctx = makeRecordCtx(false)
    await expect(recordHandler(ctx, {
      taskId: 'task-1' as TaskId,
      agent: 'forge',
      model: 'gpt-5',
      inputTokens: 10,
      outputTokens: 5,
      estimatedCostUsd: 0.01,
    })).rejects.toThrow('Unauthenticated')
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// aggregateByPeriod — granularity branches + out-of-range exclusion
// ──────────────────────────────────────────────────────────────────────────────
describe('aggregateByPeriod granularity and range branches', () => {
  it('creates 1-hour buckets for hour granularity', () => {
    const hourMs = 60 * 60 * 1000
    const start = 1_700_000_000_000
    const end = start + 3 * hourMs - 1
    const rows = [
      makeTelemetry({ _id: 'a' as CostTelemetryId, timestamp: start + 1000, estimatedCostUsd: 5 }),
      makeTelemetry({ _id: 'b' as CostTelemetryId, timestamp: start + hourMs + 1000, estimatedCostUsd: 3 }),
    ]
    const result = costTelemetryModule.aggregateByPeriod(rows, 'hour', start, end)
    // start=1_700_000_000_000 is not hour-aligned so firstBucketStart falls before start,
    // producing 4 buckets instead of 3; verify the two populated buckets and label format
    expect(result.length).toBeGreaterThanOrEqual(3)
    const filledBuckets = result.filter((b) => b.entries > 0)
    expect(filledBuckets).toHaveLength(2)
    expect(filledBuckets[0].costUsd).toBe(5)
    expect(filledBuckets[1].costUsd).toBe(3)
    expect(result[0].label).toMatch(/:00:00Z$/)
  })

  it('creates 7-day buckets for week granularity', () => {
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const start = 1_699_200_000_000
    const end = start + 2 * weekMs - 1
    const rows = [
      makeTelemetry({ _id: 'a' as CostTelemetryId, timestamp: start + 1000, estimatedCostUsd: 10 }),
    ]
    const result = costTelemetryModule.aggregateByPeriod(rows, 'week', start, end)
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result[0].costUsd).toBe(10)
  })

  it('excludes rows with timestamp outside [startMs, endMs]', () => {
    const start = 1_700_000_000_000
    const end = start + 24 * 60 * 60 * 1000 - 1
    const rows = [
      makeTelemetry({ _id: 'in' as CostTelemetryId, timestamp: start + 1000, estimatedCostUsd: 7 }),
      makeTelemetry({ _id: 'before' as CostTelemetryId, timestamp: start - 1000, estimatedCostUsd: 99 }),
      makeTelemetry({ _id: 'after' as CostTelemetryId, timestamp: end + 1000, estimatedCostUsd: 99 }),
    ]
    const result = costTelemetryModule.aggregateByPeriod(rows, 'day', start, end)
    const totalCost = result.reduce((sum, b) => sum + b.costUsd, 0)
    expect(totalCost).toBe(7)
  })

  it('day granularity label is YYYY-MM-DD format', () => {
    const start = 1_700_000_000_000
    const end = start + 24 * 60 * 60 * 1000 - 1
    const result = costTelemetryModule.aggregateByPeriod([], 'day', start, end)
    expect(result[0].label).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// aggregateByCategory — 'model' branch
// ──────────────────────────────────────────────────────────────────────────────
describe('aggregateByCategory model branch', () => {
  it("groups by model field when categoryType is 'model'", () => {
    const rows = [
      makeTelemetry({ _id: 'a' as CostTelemetryId, agent: 'forge', model: 'gpt-5', estimatedCostUsd: 4 }),
      makeTelemetry({ _id: 'b' as CostTelemetryId, agent: 'forge', model: 'gpt-5', estimatedCostUsd: 6 }),
      makeTelemetry({ _id: 'c' as CostTelemetryId, agent: 'sentinel', model: 'claude-3', estimatedCostUsd: 2 }),
    ]
    const result = costTelemetryModule.aggregateByCategory(rows, 'model')
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ category: 'gpt-5', categoryType: 'model', costUsd: 10 })
    expect(result[1]).toMatchObject({ category: 'claude-3', categoryType: 'model', costUsd: 2 })
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// detectAnomaliesFromAggregates edge cases
// ──────────────────────────────────────────────────────────────────────────────
describe('detectAnomaliesFromAggregates edge cases', () => {
  it('emits no spike when period.length < 3', () => {
    const anomalies = costTelemetryModule.detectAnomaliesFromAggregates(
      [
        { bucketStart: 1, bucketEnd: 2, label: 'd1', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 100 },
        { bucketStart: 3, bucketEnd: 4, label: 'd2', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 5 },
      ],
      [],
      [],
    )
    expect(anomalies.some((a) => a.kind === 'spike' || a.kind === 'drop')).toBe(false)
  })

  it('emits no spike when stdDev is 0 (all equal costs)', () => {
    const anomalies = costTelemetryModule.detectAnomaliesFromAggregates(
      [
        { bucketStart: 1, bucketEnd: 2, label: 'd1', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 10 },
        { bucketStart: 3, bucketEnd: 4, label: 'd2', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 10 },
        { bucketStart: 5, bucketEnd: 6, label: 'd3', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 10 },
      ],
      [],
      [],
    )
    expect(anomalies.some((a) => a.kind === 'spike' || a.kind === 'drop')).toBe(false)
  })

  it('emits no spike when zScore < 2 (small variance)', () => {
    const anomalies = costTelemetryModule.detectAnomaliesFromAggregates(
      [
        { bucketStart: 1, bucketEnd: 2, label: 'd1', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 10 },
        { bucketStart: 3, bucketEnd: 4, label: 'd2', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 11 },
        { bucketStart: 5, bucketEnd: 6, label: 'd3', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 10.5 },
      ],
      [],
      [],
    )
    expect(anomalies.some((a) => a.kind === 'spike' || a.kind === 'drop')).toBe(false)
  })

  it('emits drop anomaly when observed cost is far below mean', () => {
    // historical=[80,100,120] → mean=100, stdDev≈16.3; observed=1 → zScore≈-6 → drop
    const anomalies = costTelemetryModule.detectAnomaliesFromAggregates(
      [
        { bucketStart: 1, bucketEnd: 2, label: 'd1', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 80 },
        { bucketStart: 3, bucketEnd: 4, label: 'd2', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 100 },
        { bucketStart: 5, bucketEnd: 6, label: 'd3', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 120 },
        { bucketStart: 7, bucketEnd: 8, label: 'd4', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 1 },
      ],
      [],
      [],
    )
    expect(anomalies.some((a) => a.kind === 'drop')).toBe(true)
  })

  it('emits medium-or-high severity for spike with score >= 2.5', () => {
    // historical=[8,10,12] → mean=10, stdDev≈1.63; observed=38 → zScore≈17.1 → high severity
    const anomalies = costTelemetryModule.detectAnomaliesFromAggregates(
      [
        { bucketStart: 1, bucketEnd: 2, label: 'd1', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 8 },
        { bucketStart: 3, bucketEnd: 4, label: 'd2', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 10 },
        { bucketStart: 5, bucketEnd: 6, label: 'd3', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 12 },
        { bucketStart: 7, bucketEnd: 8, label: 'd4', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 38 },
      ],
      [],
      [],
    )
    const spike = anomalies.find((a) => a.kind === 'spike')
    expect(spike).toBeDefined()
    expect(spike?.score).toBeGreaterThanOrEqual(2.5)
    expect(['medium', 'high']).toContain(spike?.severity)
  })

  it('emits no project_outlier when projectMean is 0', () => {
    const anomalies = costTelemetryModule.detectAnomaliesFromAggregates(
      [],
      [
        { project: 'alpha', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 0 },
        { project: 'beta', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 0 },
      ],
      [],
    )
    expect(anomalies.some((a) => a.kind === 'project_outlier')).toBe(false)
  })

  it('emits no category_outlier when categoryMean is 0', () => {
    const anomalies = costTelemetryModule.detectAnomaliesFromAggregates(
      [],
      [],
      [
        { category: 'forge', categoryType: 'agent', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 0 },
        { category: 'sentinel', categoryType: 'agent', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 0 },
      ],
    )
    expect(anomalies.some((a) => a.kind === 'category_outlier')).toBe(false)
  })

  it('emits no project_outlier when percentDelta < 1.5', () => {
    const anomalies = costTelemetryModule.detectAnomaliesFromAggregates(
      [],
      [
        { project: 'alpha', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 12 },
        { project: 'beta', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 10 },
        { project: 'gamma', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 9 },
      ],
      [],
    )
    expect(anomalies.some((a) => a.kind === 'project_outlier')).toBe(false)
  })

  it('emits no category_outlier when percentDelta < 1.25', () => {
    const anomalies = costTelemetryModule.detectAnomaliesFromAggregates(
      [],
      [],
      [
        { category: 'forge', categoryType: 'agent', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 12 },
        { category: 'sentinel', categoryType: 'agent', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 10 },
        { category: 'jarvis', categoryType: 'agent', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 9 },
      ],
    )
    expect(anomalies.some((a) => a.kind === 'category_outlier')).toBe(false)
  })
})
