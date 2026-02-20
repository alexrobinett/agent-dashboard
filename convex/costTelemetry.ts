import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'

const MAX_LIMIT = 200
const MAX_AGENT_LEN = 80
const MAX_MODEL_LEN = 120

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

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
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
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthenticated')

    const taskId = args.taskId as Id<'tasks'>
    const agent = requireNonEmptyTrimmed(args.agent, 'agent', MAX_AGENT_LEN)
    const model = requireNonEmptyTrimmed(args.model, 'model', MAX_MODEL_LEN)
    const inputTokens = requireNonNegativeInteger(args.inputTokens, 'inputTokens')
    const outputTokens = requireNonNegativeInteger(args.outputTokens, 'outputTokens')
    const estimatedCostUsd = requireNonNegativeFinite(args.estimatedCostUsd, 'estimatedCostUsd')
    const timestamp = args.timestamp === undefined
      ? Date.now()
      : requireNonNegativeInteger(args.timestamp, 'timestamp')

    const doc = {
      taskId,
      agent,
      model,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      timestamp,
      runId: normalizeOptionalString(args.runId),
      sessionKey: normalizeOptionalString(args.sessionKey),
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
  handler: async (ctx, args) => {
    const limit = normalizeLimit(args.limit)
    return await ctx.db
      .query('costTelemetry')
      .withIndex('by_task_and_timestamp', (q) => q.eq('taskId', args.taskId))
      .order('desc')
      .take(limit)
  },
})

export const listByRun = query({
  args: {
    runId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const runId = requireNonEmptyTrimmed(args.runId, 'runId', 200)
    const limit = normalizeLimit(args.limit)
    return await ctx.db
      .query('costTelemetry')
      .withIndex('by_run_id', (q) => q.eq('runId', runId))
      .order('desc')
      .take(limit)
  },
})
