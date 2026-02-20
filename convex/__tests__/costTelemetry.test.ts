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
type IndexName = 'by_task_and_timestamp' | 'by_run_id'

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

          let filtered = [...docs]
          for (const call of eqCalls) {
            filtered = filtered.filter((doc: any) => doc[call.field] === call.value)
          }

          if (indexName === 'by_task_and_timestamp' || indexName === 'by_run_id') {
            filtered.sort((a: any, b: any) => (b.timestamp as number) - (a.timestamp as number))
          }

          return {
            order: () => ({
              take: async (n: number) => filtered.slice(0, n),
            }),
          }
        },
      }),
    },
    auth: {
      getUserIdentity: async () => ({ tokenIdentifier: 'test|user', subject: 'test-user', issuer: 'test' }),
    },
    _docs: docs,
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
  })
})
