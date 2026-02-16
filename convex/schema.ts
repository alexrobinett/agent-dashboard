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

  // Push notification tokens for iOS devices
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
