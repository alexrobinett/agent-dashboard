import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

// Status and priority unions — shared source of truth
// Keep in sync with ~/clawd/convex/schema.ts (agent backend)
const taskStatus = v.union(
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

const taskPriority = v.union(
  v.literal('low'),
  v.literal('normal'),
  v.literal('high'),
  v.literal('urgent'),
)

export default defineSchema({
  // Leases for task ownership (prevents race conditions in dispatch)
  leases: defineTable({
    taskId: v.id('tasks'),
    owner: v.string(),
    expiresAt: v.number(),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_task', ['taskId'])
    .index('by_owner', ['owner'])
    .index('by_expires', ['expiresAt']),

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

    // Lease management for atomic ownership handoff
    leaseOwner: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    handoffCount: v.optional(v.number()),
    version: v.optional(v.number()),

    // Handoff payload (agent→agent context)
    handoffPayload: v.optional(
      v.object({
        contextSummary: v.string(),
        filesChanged: v.array(v.string()),
        testsPassed: v.boolean(),
        remainingRisk: v.string(),
      })
    ),

    // Dispatch tracking
    attemptCount: v.optional(v.number()),
    lastHeartbeatAt: v.optional(v.number()),
  })
    .index('by_status', ['status'])
    .index('by_agent', ['assignedAgent'])
    .index('by_created_at', ['createdAt'])
    .index('by_status_and_agent', ['status', 'assignedAgent'])
    .index('by_parent', ['parentTask'])
    .index('by_project', ['project'])
    .index('by_status_and_started', ['status', 'startedAt'])
    .index('by_lease_expires', ['leaseExpiresAt']),

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
    actor: v.string(),
    actorType: v.union(
      v.literal('agent'),
      v.literal('user'),
      v.literal('system')
    ),
    action: v.union(
      v.literal('created'),
      v.literal('claimed'),
      v.literal('started'),
      v.literal('completed'),
      v.literal('updated'),
      v.literal('blocked'),
      v.literal('handed_off')
    ),
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
})
