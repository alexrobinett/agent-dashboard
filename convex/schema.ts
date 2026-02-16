import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    assignedAgent: v.string(),
    createdBy: v.string(),
    status: v.string(),
    priority: v.string(),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    dueAt: v.optional(v.number()),
    parentTask: v.optional(v.id('tasks')),
    tags: v.optional(v.array(v.string())),
    project: v.string(),
    notes: v.optional(v.string()),
    // Lease management
    leaseOwner: v.optional(v.string()),
    leaseExpiresAt: v.optional(v.number()),
    // Handoff tracking
    handoffCount: v.optional(v.number()),
    handoffPayload: v.optional(
      v.object({
        contextSummary: v.string(),
        filesChanged: v.array(v.string()),
        testsPassed: v.boolean(),
        remainingRisk: v.string(),
      })
    ),
  }),

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
