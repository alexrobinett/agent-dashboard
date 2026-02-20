import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'

const MAX_LIMIT = 200
const MAX_AGENT_LEN = 80
const MAX_MODEL_LEN = 120
const MAX_RUN_ID_LEN = 200
const MAX_SESSION_KEY_LEN = 200

function requireNonEmptyTrimmed(value: string, fieldName: string, maxLen: number): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`)
  }
  if (trimmed.length > maxLen) {
    throw new Error(`${fieldName} must be <= ${maxLen} characters`)
  }
  return trimmed
}

function requireNonNegativeInteger(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`)
  }
  return value
}

function requireNonNegativeFinite(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number`)
  }
  return value
}

function normalizeOptionalString(
  value: string | undefined,
  fieldName: string,
  maxLen: number,
): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  if (trimmed.length > maxLen) {
    throw new Error(`${fieldName} must be <= ${maxLen} characters`)
  }
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeLimit(limit?: number): number {
  if (limit === undefined) return 50
  if (!Number.isFinite(limit) || !Number.isInteger(limit)) {
    throw new Error('limit must be an integer')
  }
  if (limit < 1) {
    throw new Error('limit must be >= 1')
  }
  return Math.min(limit, MAX_LIMIT)
}

type RecordArgs = {
  taskId: Id<'tasks'>
  agent: string
  model: string
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
  timestamp?: number
  runId?: string
  sessionKey?: string
}

type ListByTaskArgs = {
  taskId: Id<'tasks'>
  limit?: number
}

type ListByRunArgs = {
  runId: string
  limit?: number
}

export const record = mutation({
  args: {
    taskId: v.id('tasks'),
    agent: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    estimatedCostUsd: v.number(),
    timestamp: v.optional(v.number()),
    runId: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
  },
  handler: async (ctx: MutationCtx, args) => {
    if (!args) throw new Error('Arguments are required')
    const typedArgs = args as unknown as RecordArgs

    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const taskId = typedArgs.taskId
    const agent = requireNonEmptyTrimmed(typedArgs.agent, 'agent', MAX_AGENT_LEN)
    const model = requireNonEmptyTrimmed(typedArgs.model, 'model', MAX_MODEL_LEN)
    const inputTokens = requireNonNegativeInteger(typedArgs.inputTokens, 'inputTokens')
    const outputTokens = requireNonNegativeInteger(typedArgs.outputTokens, 'outputTokens')
    const estimatedCostUsd = requireNonNegativeFinite(typedArgs.estimatedCostUsd, 'estimatedCostUsd')
    const timestamp = typedArgs.timestamp === undefined
      ? Date.now()
      : requireNonNegativeInteger(typedArgs.timestamp, 'timestamp')

    const doc = {
      taskId,
      agent,
      model,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      timestamp,
      runId: normalizeOptionalString(typedArgs.runId, 'runId', MAX_RUN_ID_LEN),
      sessionKey: normalizeOptionalString(typedArgs.sessionKey, 'sessionKey', MAX_SESSION_KEY_LEN),
    }

    const id = await ctx.db.insert('costTelemetry', doc)
    return { id }
  },
})

export const listByTask = query({
  args: {
    taskId: v.id('tasks'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: QueryCtx, args) => {
    if (!args) throw new Error('Arguments are required')
    const typedArgs = args as unknown as ListByTaskArgs
    const limit = normalizeLimit(typedArgs.limit)
    return await ctx.db
      .query('costTelemetry')
      .withIndex('by_task_and_timestamp', (q) => q.eq('taskId', typedArgs.taskId))
      .order('desc')
      .take(limit)
  },
})

export const listByRun = query({
  args: {
    runId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx: QueryCtx, args) => {
    if (!args) throw new Error('Arguments are required')
    const typedArgs = args as unknown as ListByRunArgs
    const runId = requireNonEmptyTrimmed(typedArgs.runId, 'runId', MAX_RUN_ID_LEN)
    const limit = normalizeLimit(typedArgs.limit)
    return await ctx.db
      .query('costTelemetry')
      .withIndex('by_run_id_and_timestamp', (q) => q.eq('runId', runId))
      .order('desc')
      .take(limit)
  },
})
