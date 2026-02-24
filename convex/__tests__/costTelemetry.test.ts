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
type EqField = 'taskId' | 'runId'
type IndexName = 'by_task_and_timestamp' | 'by_run_id_and_timestamp'

type HandlerConfig<TArgs, TResult> = {
  handler: (ctx: MockCtx, args: TArgs) => Promise<TResult>
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

const listByTaskHandler = (
  costTelemetryModule.listByTask as unknown as HandlerConfig<
    { taskId: TaskId; limit?: number },
    CostTelemetryDoc[]
  >
).handler

const listByRunHandler = (
  costTelemetryModule.listByRun as unknown as HandlerConfig<
    { runId: string; limit?: number },
    CostTelemetryDoc[]
  >
).handler

type MockCtx = {
  db: {
    insert: (table: 'costTelemetry', doc: CostTelemetryFields) => Promise<CostTelemetryId>
    query: (table: 'costTelemetry') => {
      withIndex: (
        indexName: IndexName,
        indexFn: (q: { eq: (field: EqField, value: string) => { eq: (field: EqField, value: string) => unknown } }) => unknown
      ) => {
        order: (_order: 'asc' | 'desc') => {
          take: (n: number) => Promise<CostTelemetryDoc[]>
        }
      }
    }
  }
  auth: { getUserIdentity: () => Promise<{ tokenIdentifier: string; subject: string; issuer: string } | null> }
  _docs: CostTelemetryDoc[]
  _queryCalls: Array<{ indexName: IndexName; eqCalls: Array<{ field: EqField; value: string }> }>
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

function makeCtx(initialDocs: CostTelemetryDoc[]): MockCtx {
  const docs = [...initialDocs]
  let idCounter = 1
  const queryCalls: Array<{ indexName: IndexName; eqCalls: Array<{ field: EqField; value: string }> }> = []

  return {
    db: {
      insert: async (_table: 'costTelemetry', doc: CostTelemetryFields) => {
        const id = `ct-${idCounter++}` as CostTelemetryId
        docs.push({ _id: id, _creationTime: Date.now(), ...doc })
        return id
      },
      query: (_table: 'costTelemetry') => ({
        withIndex: (indexName, indexFn) => {
          const eqCalls: Array<{ field: EqField; value: string }> = []
          const chain = {
            eq: (field: EqField, value: string) => {
              eqCalls.push({ field, value })
              return chain
            },
          }
          indexFn(chain)
          const queryCall = { indexName, eqCalls: [...eqCalls] }

          let filtered = [...docs]
          for (const call of eqCalls) {
            filtered = filtered.filter((doc: any) => doc[call.field] === call.value)
          }
          const supportsTimestampOrdering =
            indexName === 'by_task_and_timestamp' || indexName === 'by_run_id_and_timestamp'

          return {
            order: (order) => ({
              take: async (n: number) => {
                const ordered = [...filtered]
                if (supportsTimestampOrdering) {
                  ordered.sort((a: any, b: any) =>
                    order === 'asc'
                      ? (a.timestamp as number) - (b.timestamp as number)
                      : (b.timestamp as number) - (a.timestamp as number)
                  )
                }
                queryCall.eqCalls = [...eqCalls]
                queryCalls.push(queryCall)
                return ordered.slice(0, n)
              },
            }),
          }
        },
      }),
    },
    auth: {
      getUserIdentity: async () => ({ tokenIdentifier: 'test|user', subject: 'test-user', issuer: 'test' }),
    },
    _docs: docs,
    _queryCalls: queryCalls,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('costTelemetry.record', () => {
  it('writes a telemetry row with explicit timestamp and run/session', async () => {
    const ctx = makeCtx([])
    const result = await recordHandler(ctx, {
      taskId: 'task-a' as TaskId,
      agent: 'forge',
      model: 'gpt-5-mini',
      inputTokens: 1200,
      outputTokens: 430,
      estimatedCostUsd: 0.0187,
      timestamp: 1_700_000_000_000,
      runId: 'run-1',
      sessionKey: 'session-1',
    })

    expect(result.id).toBe('ct-1')
    expect(ctx._docs).toHaveLength(1)
    expect(ctx._docs[0]).toMatchObject({
      taskId: 'task-a',
      agent: 'forge',
      model: 'gpt-5-mini',
      inputTokens: 1200,
      outputTokens: 430,
      estimatedCostUsd: 0.0187,
      timestamp: 1_700_000_000_000,
      runId: 'run-1',
      sessionKey: 'session-1',
    })
  })

  it('defaults timestamp and normalizes empty run/session to undefined', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000)
    const ctx = makeCtx([])
    await recordHandler(ctx, {
      taskId: 'task-b' as TaskId,
      agent: 'sentinel',
      model: 'gpt-5',
      inputTokens: 1,
      outputTokens: 2,
      estimatedCostUsd: 0,
      runId: '  ',
      sessionKey: '',
    })

    expect(ctx._docs[0].timestamp).toBe(1_800_000_000_000)
    expect(ctx._docs[0].runId).toBeUndefined()
    expect(ctx._docs[0].sessionKey).toBeUndefined()
  })

  it('rejects invalid token and cost values', async () => {
    const ctx = makeCtx([])
    await expect(recordHandler(ctx, {
      taskId: 'task-c' as TaskId,
      agent: 'forge',
      model: 'gpt-5',
      inputTokens: -1,
      outputTokens: 10,
      estimatedCostUsd: 0.1,
    })).rejects.toThrow('inputTokens must be a non-negative integer')

    await expect(recordHandler(ctx, {
      taskId: 'task-c' as TaskId,
      agent: 'forge',
      model: 'gpt-5',
      inputTokens: 1,
      outputTokens: 1.5,
      estimatedCostUsd: 0.1,
    })).rejects.toThrow('outputTokens must be a non-negative integer')

    await expect(recordHandler(ctx, {
      taskId: 'task-c' as TaskId,
      agent: 'forge',
      model: 'gpt-5',
      inputTokens: 1,
      outputTokens: 2,
      estimatedCostUsd: -0.1,
    })).rejects.toThrow('estimatedCostUsd must be a non-negative number')
  })

  it('rejects runId and sessionKey longer than 200 characters', async () => {
    const ctx = makeCtx([])
    const tooLong = 'x'.repeat(201)

    await expect(recordHandler(ctx, {
      taskId: 'task-d' as TaskId,
      agent: 'forge',
      model: 'gpt-5',
      inputTokens: 1,
      outputTokens: 2,
      estimatedCostUsd: 0.1,
      runId: tooLong,
    })).rejects.toThrow('runId must be <= 200 characters')

    await expect(recordHandler(ctx, {
      taskId: 'task-d' as TaskId,
      agent: 'forge',
      model: 'gpt-5',
      inputTokens: 1,
      outputTokens: 2,
      estimatedCostUsd: 0.1,
      sessionKey: tooLong,
    })).rejects.toThrow('sessionKey must be <= 200 characters')
  })
})

describe('costTelemetry aggregations + anomaly primitives', () => {
  it('aggregateByPeriod creates ordered buckets and zero-fills missing intervals', () => {
    const rows = [
      makeTelemetry({ _id: 'a' as CostTelemetryId, timestamp: 1_700_000_100_000, estimatedCostUsd: 1, inputTokens: 10, outputTokens: 5 }),
      makeTelemetry({ _id: 'b' as CostTelemetryId, timestamp: 1_700_000_200_000, estimatedCostUsd: 2, inputTokens: 20, outputTokens: 10 }),
      makeTelemetry({ _id: 'c' as CostTelemetryId, timestamp: 1_700_172_800_000, estimatedCostUsd: 4, inputTokens: 40, outputTokens: 20 }),
    ]

    const result = costTelemetryModule.aggregateByPeriod(rows, 'day', 1_699_987_200_000, 1_700_259_199_999)
    expect(result).toHaveLength(4)
    expect(result.map((bucket) => bucket.entries)).toEqual([2, 0, 1, 0])
    expect(result[0].costUsd).toBe(3)
    expect(result[2].costUsd).toBe(4)
  })

  it('aggregateByProject groups by mapped project and falls back to unassigned', () => {
    const rows = [
      makeTelemetry({ _id: 'a' as CostTelemetryId, taskId: 'task-1' as TaskId, estimatedCostUsd: 2 }),
      makeTelemetry({ _id: 'b' as CostTelemetryId, taskId: 'task-1' as TaskId, estimatedCostUsd: 3 }),
      makeTelemetry({ _id: 'c' as CostTelemetryId, taskId: 'task-2' as TaskId, estimatedCostUsd: 5 }),
    ]

    const projects = costTelemetryModule.aggregateByProject(rows, new Map<TaskId, string>([
      ['task-1' as TaskId, 'alpha'],
    ]))

    expect(projects).toHaveLength(2)
    expect(projects).toEqual(expect.arrayContaining([
      expect.objectContaining({ project: 'unassigned', costUsd: 5, entries: 1 }),
      expect.objectContaining({ project: 'alpha', costUsd: 5, entries: 2 }),
    ]))
  })

  it('detectAnomaliesFromAggregates flags spikes and outliers', () => {
    const anomalies = costTelemetryModule.detectAnomaliesFromAggregates(
      [
        { bucketStart: 1, bucketEnd: 2, label: 'd1', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 10 },
        { bucketStart: 3, bucketEnd: 4, label: 'd2', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 11 },
        { bucketStart: 5, bucketEnd: 6, label: 'd3', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 12 },
        { bucketStart: 7, bucketEnd: 8, label: 'd4', entries: 1, inputTokens: 1, outputTokens: 1, costUsd: 40 },
      ],
      [
        { project: 'core', entries: 5, inputTokens: 10, outputTokens: 10, costUsd: 200 },
        { project: 'misc-a', entries: 5, inputTokens: 10, outputTokens: 10, costUsd: 10 },
        { project: 'misc-b', entries: 5, inputTokens: 10, outputTokens: 10, costUsd: 10 },
      ],
      [
        { category: 'forge', categoryType: 'agent', entries: 5, inputTokens: 10, outputTokens: 10, costUsd: 180 },
        { category: 'sentinel', categoryType: 'agent', entries: 5, inputTokens: 10, outputTokens: 10, costUsd: 20 },
        { category: 'jarvis', categoryType: 'agent', entries: 5, inputTokens: 10, outputTokens: 10, costUsd: 10 },
      ],
    )

    expect(anomalies.some((a) => a.kind === 'spike')).toBe(true)
    expect(anomalies.some((a) => a.kind === 'project_outlier' && a.project === 'core')).toBe(true)
    expect(anomalies.some((a) => a.kind === 'category_outlier' && a.category === 'forge')).toBe(true)
  })
})

describe('costTelemetry read queries', () => {
  it('listByTask returns newest rows for the task and applies limit', async () => {
    const ctx = makeCtx([
      makeTelemetry({
        _id: 'a' as CostTelemetryId,
        taskId: 'task-1' as TaskId,
        timestamp: 1_000,
      }),
      makeTelemetry({
        _id: 'b' as CostTelemetryId,
        taskId: 'task-1' as TaskId,
        timestamp: 3_000,
      }),
      makeTelemetry({
        _id: 'c' as CostTelemetryId,
        taskId: 'task-2' as TaskId,
        timestamp: 2_000,
      }),
      makeTelemetry({
        _id: 'd' as CostTelemetryId,
        taskId: 'task-1' as TaskId,
        timestamp: 2_000,
      }),
    ])

    const result = await listByTaskHandler(ctx, { taskId: 'task-1' as TaskId, limit: 2 })
    expect(result.map((row) => row._id)).toEqual(['b', 'd'])
  })

  it('listByRun reads rows by runId in descending timestamp order', async () => {
    const ctx = makeCtx([
      makeTelemetry({
        _id: 'a' as CostTelemetryId,
        runId: 'run-1',
        timestamp: 100,
      }),
      makeTelemetry({
        _id: 'b' as CostTelemetryId,
        runId: 'run-2',
        timestamp: 300,
      }),
      makeTelemetry({
        _id: 'c' as CostTelemetryId,
        runId: 'run-1',
        timestamp: 200,
      }),
    ])

    const result = await listByRunHandler(ctx, { runId: 'run-1', limit: 10 })
    expect(result.map((row) => row._id)).toEqual(['c', 'a'])
    expect(ctx._queryCalls[0]).toEqual({
      indexName: 'by_run_id_and_timestamp',
      eqCalls: [{ field: 'runId', value: 'run-1' }],
    })
  })

  it('listByRun enforces the same runId length cap as record writes', async () => {
    const ctx = makeCtx([])
    const tooLong = 'x'.repeat(201)
    await expect(listByRunHandler(ctx, { runId: tooLong, limit: 10 }))
      .rejects
      .toThrow('runId must be <= 200 characters')
  })
})

describe('costTelemetry aggregateByCategory', () => {
  it('aggregateByCategory groups by agent and merges duplicate entries', () => {
    const rows = [
      makeTelemetry({ _id: 'a' as CostTelemetryId, agent: 'forge', model: 'gpt-5', estimatedCostUsd: 1, inputTokens: 10, outputTokens: 5 }),
      makeTelemetry({ _id: 'b' as CostTelemetryId, agent: 'forge', model: 'gpt-5', estimatedCostUsd: 2, inputTokens: 20, outputTokens: 10 }),
      makeTelemetry({ _id: 'c' as CostTelemetryId, agent: 'sentinel', model: 'claude-3', estimatedCostUsd: 5, inputTokens: 50, outputTokens: 25 }),
    ]

    const result = costTelemetryModule.aggregateByCategory(rows, 'agent')
    expect(result).toHaveLength(2)
    // sorted by costUsd descending
    expect(result[0].category).toBe('sentinel')
    expect(result[0].categoryType).toBe('agent')
    expect(result[0].entries).toBe(1)
    expect(result[0].costUsd).toBe(5)
    expect(result[1].category).toBe('forge')
    expect(result[1].entries).toBe(2)
    expect(result[1].costUsd).toBe(3)
    expect(result[1].inputTokens).toBe(30)
  })

  it('aggregateByCategory groups by model type', () => {
    const rows = [
      makeTelemetry({ _id: 'a' as CostTelemetryId, agent: 'forge', model: 'gpt-5', estimatedCostUsd: 3, inputTokens: 30, outputTokens: 15 }),
      makeTelemetry({ _id: 'b' as CostTelemetryId, agent: 'sentinel', model: 'claude-3', estimatedCostUsd: 7, inputTokens: 70, outputTokens: 35 }),
      makeTelemetry({ _id: 'c' as CostTelemetryId, agent: 'forge', model: 'claude-3', estimatedCostUsd: 2, inputTokens: 20, outputTokens: 10 }),
    ]

    const result = costTelemetryModule.aggregateByCategory(rows, 'model')
    expect(result).toHaveLength(2)
    const claudeBucket = result.find((b) => b.category === 'claude-3')
    const gptBucket = result.find((b) => b.category === 'gpt-5')
    expect(claudeBucket).toBeDefined()
    expect(claudeBucket!.entries).toBe(2)
    expect(claudeBucket!.costUsd).toBe(9)
    expect(claudeBucket!.categoryType).toBe('model')
    expect(gptBucket).toBeDefined()
    expect(gptBucket!.entries).toBe(1)
  })

  it('aggregateByCategory returns empty array for no rows', () => {
    const result = costTelemetryModule.aggregateByCategory([], 'agent')
    expect(result).toHaveLength(0)
  })
})

describe('costTelemetry aggregateByPeriod — hour and week granularity', () => {
  it('aggregateByPeriod creates hourly buckets with correct labels', () => {
    const baseHour = 1_700_000_000_000 // some timestamp
    const rows = [
      makeTelemetry({ _id: 'a' as CostTelemetryId, timestamp: baseHour + 1_000, estimatedCostUsd: 1, inputTokens: 10, outputTokens: 5 }),
      makeTelemetry({ _id: 'b' as CostTelemetryId, timestamp: baseHour + 3_600_000 + 1_000, estimatedCostUsd: 2, inputTokens: 20, outputTokens: 10 }),
    ]

    const hourMs = 60 * 60 * 1000
    const startMs = Math.floor(baseHour / hourMs) * hourMs
    const endMs = startMs + 2 * hourMs - 1

    const result = costTelemetryModule.aggregateByPeriod(rows, 'hour', startMs, endMs)
    expect(result).toHaveLength(2)
    // Hourly labels contain hours (format: YYYY-MM-DDTHH:00:00Z)
    expect(result[0].label).toMatch(/T\d{2}:00:00Z$/)
    expect(result[0].entries).toBe(1)
    expect(result[1].entries).toBe(1)
  })

  it('aggregateByPeriod creates weekly buckets', () => {
    const weekMs = 7 * 24 * 60 * 60 * 1000
    const baseWeek = Math.floor(1_700_000_000_000 / weekMs) * weekMs
    const rows = [
      makeTelemetry({ _id: 'a' as CostTelemetryId, timestamp: baseWeek + 1_000, estimatedCostUsd: 10, inputTokens: 100, outputTokens: 50 }),
    ]

    const result = costTelemetryModule.aggregateByPeriod(rows, 'week', baseWeek, baseWeek + weekMs - 1)
    expect(result).toHaveLength(1)
    // Weekly label is date format YYYY-MM-DD
    expect(result[0].label).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result[0].entries).toBe(1)
    expect(result[0].costUsd).toBe(10)
  })
})

describe('costTelemetry getAnalytics and getAnomalyPrimitives handlers', () => {
  type AnalyticsHandlerConfig = {
    handler: (ctx: AnalyticsMockCtx, args: unknown) => Promise<unknown>
  }

  type AnalyticsMockCtx = {
    db: {
      query: (table: string) => {
        withIndex: (indexName: string, fn: unknown) => {
          collect: () => Promise<CostTelemetryDoc[]>
        }
      }
      get: (id: string) => Promise<{ project?: string } | null>
    }
  }

  function makeAnalyticsCtx(docs: CostTelemetryDoc[], taskProjects: Record<string, string> = {}): AnalyticsMockCtx {
    return {
      db: {
        query: (_table: string) => ({
          withIndex: (_indexName: string, _fn: unknown) => ({
            collect: async () => docs,
          }),
        }),
        get: async (id: string) => {
          const project = taskProjects[id]
          return project !== undefined ? { project } : null
        },
      },
    }
  }

  const getAnalyticsHandler = (
    costTelemetryModule.getAnalytics as unknown as AnalyticsHandlerConfig
  ).handler

  const getAnomalyPrimitivesHandler = (
    costTelemetryModule.getAnomalyPrimitives as unknown as AnalyticsHandlerConfig
  ).handler

  it('getAnalytics returns aggregated totals, period, projects, and categories', async () => {
    const now = Date.now()
    const docs = [
      makeTelemetry({ _id: 'a' as CostTelemetryId, taskId: 'task-1' as TaskId, agent: 'forge', model: 'gpt-5', estimatedCostUsd: 5, inputTokens: 50, outputTokens: 25, timestamp: now - 3600_000 }),
      makeTelemetry({ _id: 'b' as CostTelemetryId, taskId: 'task-2' as TaskId, agent: 'sentinel', model: 'claude-3', estimatedCostUsd: 10, inputTokens: 100, outputTokens: 50, timestamp: now - 7200_000 }),
    ]

    const ctx = makeAnalyticsCtx(docs, { 'task-1': 'project-alpha', 'task-2': 'project-beta' })
    const result = await getAnalyticsHandler(ctx, {}) as { totals: { entries: number; costUsd: number; uniqueProjects: number }; period: unknown[]; projects: unknown[]; categories: unknown[] }

    expect(result.totals.entries).toBe(2)
    expect(result.totals.costUsd).toBeCloseTo(15)
    expect(result.totals.uniqueProjects).toBe(2)
    expect(Array.isArray(result.period)).toBe(true)
    expect(Array.isArray(result.projects)).toBe(true)
    expect(Array.isArray(result.categories)).toBe(true)
  })

  it('getAnomalyPrimitives returns anomalies array', async () => {
    const now = Date.now()
    const docs = [
      makeTelemetry({ _id: 'a' as CostTelemetryId, taskId: 'task-1' as TaskId, agent: 'forge', model: 'gpt-5', estimatedCostUsd: 1, inputTokens: 10, outputTokens: 5, timestamp: now - 3600_000 }),
    ]

    const ctx = makeAnalyticsCtx(docs)
    const result = await getAnomalyPrimitivesHandler(ctx, {}) as { anomalies: unknown[] }

    expect(Array.isArray(result.anomalies)).toBe(true)
  })
})
