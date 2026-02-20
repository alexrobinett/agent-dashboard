import { mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'

const MAX_LIMIT = 200
const MAX_AGENT_LEN = 80
const MAX_MODEL_LEN = 120
const MAX_RUN_ID_LEN = 200
const MAX_SESSION_KEY_LEN = 200

const PERIOD_GRANULARITY = v.union(v.literal('hour'), v.literal('day'), v.literal('week'))
const CATEGORY_TYPE = v.union(v.literal('agent'), v.literal('model'))

export type PeriodGranularity = 'hour' | 'day' | 'week'
export type CategoryType = 'agent' | 'model'

type TelemetryDoc = Doc<'costTelemetry'>

type PeriodBucket = {
  bucketStart: number
  bucketEnd: number
  label: string
  entries: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

type ProjectBucket = {
  project: string
  entries: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

type CategoryBucket = {
  category: string
  categoryType: CategoryType
  entries: number
  inputTokens: number
  outputTokens: number
  costUsd: number
}

type CostAnalyticsResponse = {
  totals: {
    entries: number
    inputTokens: number
    outputTokens: number
    costUsd: number
    uniqueProjects: number
  }
  period: PeriodBucket[]
  projects: ProjectBucket[]
  categories: CategoryBucket[]
}

type AnomalyPrimitive = {
  kind: 'spike' | 'drop' | 'project_outlier' | 'category_outlier'
  severity: 'low' | 'medium' | 'high'
  score: number
  timestamp?: number
  bucketStart?: number
  project?: string
  category?: string
  categoryType?: CategoryType
  expectedCostUsd: number
  observedCostUsd: number
  deltaCostUsd: number
  percentDelta: number
}

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

function normalizeRange(startMs: number | undefined, endMs: number | undefined): { startMs: number; endMs: number } {
  const now = Date.now()
  const normalizedEnd = endMs === undefined ? now : requireNonNegativeInteger(endMs, 'endMs')
  const normalizedStart = startMs === undefined ? normalizedEnd - 7 * 24 * 60 * 60 * 1000 : requireNonNegativeInteger(startMs, 'startMs')

  if (normalizedStart > normalizedEnd) {
    throw new Error('startMs must be <= endMs')
  }

  return { startMs: normalizedStart, endMs: normalizedEnd }
}

function granularityToMs(granularity: PeriodGranularity): number {
  if (granularity === 'hour') return 60 * 60 * 1000
  if (granularity === 'day') return 24 * 60 * 60 * 1000
  return 7 * 24 * 60 * 60 * 1000
}

function formatBucketLabel(bucketStart: number, granularity: PeriodGranularity): string {
  const date = new Date(bucketStart)
  if (granularity === 'hour') return date.toISOString().slice(0, 13) + ':00:00Z'
  return date.toISOString().slice(0, 10)
}

function toPercentDelta(observed: number, expected: number): number {
  if (expected <= 0 && observed <= 0) return 0
  if (expected <= 0) return 1
  return (observed - expected) / expected
}

function toSeverity(score: number): 'low' | 'medium' | 'high' {
  if (score >= 3.5) return 'high'
  if (score >= 2.5) return 'medium'
  return 'low'
}

function summarizeRows(rows: TelemetryDoc[]): { entries: number; inputTokens: number; outputTokens: number; costUsd: number } {
  let inputTokens = 0
  let outputTokens = 0
  let costUsd = 0
  for (const row of rows) {
    inputTokens += row.inputTokens
    outputTokens += row.outputTokens
    costUsd += row.estimatedCostUsd
  }
  return { entries: rows.length, inputTokens, outputTokens, costUsd }
}

export function aggregateByPeriod(
  rows: TelemetryDoc[],
  granularity: PeriodGranularity,
  startMs: number,
  endMs: number,
): PeriodBucket[] {
  const bucketSizeMs = granularityToMs(granularity)
  const firstBucketStart = Math.floor(startMs / bucketSizeMs) * bucketSizeMs
  const bucketMap = new Map<number, PeriodBucket>()

  for (let cursor = firstBucketStart; cursor <= endMs; cursor += bucketSizeMs) {
    bucketMap.set(cursor, {
      bucketStart: cursor,
      bucketEnd: cursor + bucketSizeMs - 1,
      label: formatBucketLabel(cursor, granularity),
      entries: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    })
  }

  for (const row of rows) {
    if (row.timestamp < startMs || row.timestamp > endMs) continue
    const bucketStart = Math.floor(row.timestamp / bucketSizeMs) * bucketSizeMs
    const bucket = bucketMap.get(bucketStart)
    if (!bucket) continue
    bucket.entries += 1
    bucket.inputTokens += row.inputTokens
    bucket.outputTokens += row.outputTokens
    bucket.costUsd += row.estimatedCostUsd
  }

  return Array.from(bucketMap.values()).sort((a, b) => a.bucketStart - b.bucketStart)
}

export function aggregateByProject(rows: TelemetryDoc[], taskProjects: Map<Id<'tasks'>, string>): ProjectBucket[] {
  const map = new Map<string, ProjectBucket>()

  for (const row of rows) {
    const project = taskProjects.get(row.taskId) ?? 'unassigned'
    const existing = map.get(project)
    if (existing) {
      existing.entries += 1
      existing.inputTokens += row.inputTokens
      existing.outputTokens += row.outputTokens
      existing.costUsd += row.estimatedCostUsd
      continue
    }
    map.set(project, {
      project,
      entries: 1,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      costUsd: row.estimatedCostUsd,
    })
  }

  return Array.from(map.values()).sort((a, b) => b.costUsd - a.costUsd)
}

export function aggregateByCategory(rows: TelemetryDoc[], categoryType: CategoryType): CategoryBucket[] {
  const map = new Map<string, CategoryBucket>()

  for (const row of rows) {
    const category = categoryType === 'agent' ? row.agent : row.model
    const existing = map.get(category)
    if (existing) {
      existing.entries += 1
      existing.inputTokens += row.inputTokens
      existing.outputTokens += row.outputTokens
      existing.costUsd += row.estimatedCostUsd
      continue
    }

    map.set(category, {
      category,
      categoryType,
      entries: 1,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      costUsd: row.estimatedCostUsd,
    })
  }

  return Array.from(map.values()).sort((a, b) => b.costUsd - a.costUsd)
}

export function detectAnomaliesFromAggregates(
  period: PeriodBucket[],
  projects: ProjectBucket[],
  categories: CategoryBucket[],
): AnomalyPrimitive[] {
  const anomalies: AnomalyPrimitive[] = []

  if (period.length >= 3) {
    const observed = period[period.length - 1]
    const historical = period.slice(0, -1)
    const mean = historical.reduce((sum, bucket) => sum + bucket.costUsd, 0) / historical.length
    const variance = historical.reduce((sum, bucket) => sum + (bucket.costUsd - mean) ** 2, 0) / historical.length
    const stdDev = Math.sqrt(variance)

    if (stdDev > 0) {
      const zScore = (observed.costUsd - mean) / stdDev
      if (Math.abs(zScore) >= 2) {
        const percentDelta = toPercentDelta(observed.costUsd, mean)
        anomalies.push({
          kind: zScore > 0 ? 'spike' : 'drop',
          severity: toSeverity(Math.abs(zScore)),
          score: Math.abs(zScore),
          timestamp: observed.bucketEnd,
          bucketStart: observed.bucketStart,
          expectedCostUsd: mean,
          observedCostUsd: observed.costUsd,
          deltaCostUsd: observed.costUsd - mean,
          percentDelta,
        })
      }
    }
  }

  const projectMean = projects.length > 0
    ? projects.reduce((sum, project) => sum + project.costUsd, 0) / projects.length
    : 0

  for (const project of projects) {
    if (projectMean <= 0) break
    const percentDelta = toPercentDelta(project.costUsd, projectMean)
    if (percentDelta >= 1.5) {
      const score = Math.max(2, percentDelta * 2)
      anomalies.push({
        kind: 'project_outlier',
        severity: toSeverity(score),
        score,
        project: project.project,
        expectedCostUsd: projectMean,
        observedCostUsd: project.costUsd,
        deltaCostUsd: project.costUsd - projectMean,
        percentDelta,
      })
    }
  }

  const categoryMean = categories.length > 0
    ? categories.reduce((sum, category) => sum + category.costUsd, 0) / categories.length
    : 0

  for (const category of categories) {
    if (categoryMean <= 0) break
    const percentDelta = toPercentDelta(category.costUsd, categoryMean)
    if (percentDelta >= 1.25) {
      const score = Math.max(2, percentDelta * 2)
      anomalies.push({
        kind: 'category_outlier',
        severity: toSeverity(score),
        score,
        category: category.category,
        categoryType: category.categoryType,
        expectedCostUsd: categoryMean,
        observedCostUsd: category.costUsd,
        deltaCostUsd: category.costUsd - categoryMean,
        percentDelta,
      })
    }
  }

  return anomalies.sort((a, b) => b.score - a.score)
}

async function fetchRowsByRange(ctx: QueryCtx, startMs: number, endMs: number): Promise<TelemetryDoc[]> {
  const chain = ctx.db
    .query('costTelemetry')
    .withIndex('by_timestamp', (q) => (q as any).gte('timestamp', startMs).lte('timestamp', endMs)) as any

  return await chain.collect()
}

async function loadTaskProjects(ctx: QueryCtx, rows: TelemetryDoc[]): Promise<Map<Id<'tasks'>, string>> {
  const uniqueTaskIds = Array.from(new Set(rows.map((row) => row.taskId)))
  const taskDocs = await Promise.all(uniqueTaskIds.map(async (taskId) => ({ taskId, task: await ctx.db.get(taskId) })))

  const projectMap = new Map<Id<'tasks'>, string>()
  for (const { taskId, task } of taskDocs) {
    projectMap.set(taskId, task?.project ?? 'unassigned')
  }
  return projectMap
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

type AnalyticsArgs = {
  startMs?: number
  endMs?: number
  granularity?: PeriodGranularity
  categoryType?: CategoryType
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

export const getAnalytics = query({
  args: {
    startMs: v.optional(v.number()),
    endMs: v.optional(v.number()),
    granularity: v.optional(PERIOD_GRANULARITY),
    categoryType: v.optional(CATEGORY_TYPE),
  },
  handler: async (ctx, args): Promise<CostAnalyticsResponse> => {
    if (!args) throw new Error('Arguments are required')
    const typedArgs = args as unknown as AnalyticsArgs

    const { startMs, endMs } = normalizeRange(typedArgs.startMs, typedArgs.endMs)
    const granularity = typedArgs.granularity ?? 'day'
    const categoryType = typedArgs.categoryType ?? 'agent'

    const rows = await fetchRowsByRange(ctx, startMs, endMs)
    const projectMap = await loadTaskProjects(ctx, rows)

    const totalsBase = summarizeRows(rows)
    const projects = aggregateByProject(rows, projectMap)

    return {
      totals: {
        ...totalsBase,
        uniqueProjects: new Set(projects.map((project) => project.project)).size,
      },
      period: aggregateByPeriod(rows, granularity, startMs, endMs),
      projects,
      categories: aggregateByCategory(rows, categoryType),
    }
  },
})

export const getAnomalyPrimitives = query({
  args: {
    startMs: v.optional(v.number()),
    endMs: v.optional(v.number()),
    granularity: v.optional(PERIOD_GRANULARITY),
    categoryType: v.optional(CATEGORY_TYPE),
  },
  handler: async (ctx, args): Promise<{ anomalies: AnomalyPrimitive[] }> => {
    if (!args) throw new Error('Arguments are required')
    const typedArgs = args as unknown as AnalyticsArgs

    const { startMs, endMs } = normalizeRange(typedArgs.startMs, typedArgs.endMs)
    const granularity = typedArgs.granularity ?? 'day'
    const categoryType = typedArgs.categoryType ?? 'agent'

    const rows = await fetchRowsByRange(ctx, startMs, endMs)
    const projectMap = await loadTaskProjects(ctx, rows)
    const period = aggregateByPeriod(rows, granularity, startMs, endMs)
    const projects = aggregateByProject(rows, projectMap)
    const categories = aggregateByCategory(rows, categoryType)

    return {
      anomalies: detectAnomaliesFromAggregates(period, projects, categories),
    }
  },
})
