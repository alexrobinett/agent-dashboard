import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// Status and priority unions — shared source of truth
export const taskStatus = v.union(
  v.literal('planning'),
  v.literal('ready'),
  v.literal('in_progress'),
  v.literal('in_review'),
  v.literal('done'),
  v.literal('blocked'),
  v.literal('cancelled'),
  // Legacy compat (will migrate away)
  v.literal('pending'),
  v.literal('active'),
)

export const taskPriority = v.union(
  v.literal('low'),
  v.literal('normal'),
  v.literal('high'),
  v.literal('urgent'),
)

export default defineSchema({
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),

    // Assignment
    assignedAgent: v.optional(v.string()),
    createdBy: v.string(),

    // Status — Jira-style board
    status: taskStatus,

    // Priority
    priority: taskPriority,

    // Timing (Unix ms)
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),

    // Hierarchy
    parentTask: v.optional(v.id('tasks')),

    // Dependencies - array of task IDs this task depends on
    dependsOn: v.optional(v.array(v.id('tasks'))),

    // Project routing
    project: v.optional(v.string()),

    // Metadata
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    result: v.optional(v.string()),
    blockedReason: v.optional(v.string()),

    // Human-friendly task key (e.g. AD-123)
    taskNumber: v.optional(v.number()),
    taskKey: v.optional(v.string()),

    // Legacy fields retained for existing rows; no active code uses them.
    leaseOwner: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    handoffCount: v.optional(v.number()),
    version: v.optional(v.number()),
    attemptCount: v.optional(v.number()),
    lastHeartbeatAt: v.optional(v.number()),

    // Handoff payload (agent→agent context)
    handoffPayload: v.optional(
      v.object({
        contextSummary: v.string(),
        filesChanged: v.array(v.string()),
        testsPassed: v.boolean(),
        remainingRisk: v.string(),
      })
    ),

    // OpenClaw session tracking
    runId: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
  })
    .index('by_status', ['status'])
    .index('by_agent', ['assignedAgent'])
    .index('by_created_at', ['createdAt'])
    .index('by_priority', ['priority'])
    .index('by_status_and_agent', ['status', 'assignedAgent'])
    .index('by_parent', ['parentTask'])
    .index('by_project', ['project'])
    .index('by_task_number', ['taskNumber'])
    .index('by_task_key', ['taskKey']),

  // User preferences for dashboard customization
  userPreferences: defineTable({
    userId: v.string(),
    defaultView: v.union(
      v.literal('kanban'),
      v.literal('list'),
      v.literal('workload')
    ),
    filterProject: v.optional(v.string()),
    filterAgent: v.optional(v.string()),
    notificationEnabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  // Activity log for audit trail
  activityLog: defineTable({
    taskId: v.id('tasks'),
    type: v.optional(v.union(
      v.literal('activity'),
      v.literal('push_queued')
    )),
    agentName: v.optional(v.string()),
    actor: v.optional(v.string()),
    actorType: v.optional(v.union(
      v.literal('agent'),
      v.literal('user'),
      v.literal('system')
    )),
    action: v.optional(v.union(
      v.literal('created'),
      v.literal('claimed'),
      v.literal('started'),
      v.literal('completed'),
      v.literal('updated'),
      v.literal('blocked'),
      v.literal('handed_off'),
      v.literal('status_changed'),
      v.literal('deleted'),
      v.literal('assigned'),
      v.literal('commented'),
      v.literal('priority_changed')
    )),
    metadata: v.optional(
      v.object({
        fromStatus: v.optional(v.string()),
        toStatus: v.optional(v.string()),
        notes: v.optional(v.string()),
      })
    ),
    timestamp: v.number(),
  })
    .index('by_task', ['taskId'])
    .index('by_timestamp', ['timestamp']),

  // Token/cost telemetry emitted by agent runs.
  costTelemetry: defineTable({
    taskId: v.id('tasks'),
    agent: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    estimatedCostUsd: v.number(),
    timestamp: v.number(),
    runId: v.optional(v.string()),
    sessionKey: v.optional(v.string()),
  })
    .index('by_task', ['taskId'])
    .index('by_timestamp', ['timestamp'])
    .index('by_task_and_timestamp', ['taskId', 'timestamp'])
    .index('by_run_id', ['runId'])
    .index('by_run_id_and_timestamp', ['runId', 'timestamp'])
    .index('by_session_key', ['sessionKey']),

  // Push tokens for iOS push notifications
  pushTokens: defineTable({
    userId: v.string(),
    deviceId: v.string(),
    token: v.string(),
    platform: v.literal('ios'),
    createdAt: v.number(),
    lastUsedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_device', ['deviceId']),
})
