/**
 * Sprint 4: Activity Log Component Tests
 *
 * Smoke-level unit test stubs for activity log integration points.
 * Tests validate the activity log data structures and action types
 * that the Activity Log component will consume.
 */

import { describe, it, expect } from 'vitest'
import { createMockTask } from '../../test/fixtures'

/** Activity log action types matching convex/activityLog.ts */
const ACTIVITY_ACTIONS = [
  'created',
  'claimed',
  'started',
  'completed',
  'updated',
  'blocked',
  'handed_off',
] as const

type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]

interface MockActivityEntry {
  taskId: string
  action: ActivityAction
  performedBy: string
  timestamp: number
  metadata?: {
    fromStatus?: string
    toStatus?: string
    notes?: string
  }
}

function createMockActivityEntry(
  overrides: Partial<MockActivityEntry> = {}
): MockActivityEntry {
  return {
    taskId: 'j57mock123',
    action: 'created',
    performedBy: 'forge',
    timestamp: Date.now(),
    metadata: undefined,
    ...overrides,
  }
}

describe('Activity Log - Data Layer', () => {
  it('should define all valid activity action types', () => {
    expect(ACTIVITY_ACTIONS).toHaveLength(7)
    expect(ACTIVITY_ACTIONS).toContain('created')
    expect(ACTIVITY_ACTIONS).toContain('claimed')
    expect(ACTIVITY_ACTIONS).toContain('started')
    expect(ACTIVITY_ACTIONS).toContain('completed')
    expect(ACTIVITY_ACTIONS).toContain('updated')
    expect(ACTIVITY_ACTIONS).toContain('blocked')
    expect(ACTIVITY_ACTIONS).toContain('handed_off')
  })

  it('should create activity entry with required fields', () => {
    const entry = createMockActivityEntry({
      taskId: 'j57task456',
      action: 'started',
      performedBy: 'sentinel',
    })

    expect(entry.taskId).toBe('j57task456')
    expect(entry.action).toBe('started')
    expect(entry.performedBy).toBe('sentinel')
    expect(entry.timestamp).toBeGreaterThan(0)
  })

  it('should support status transition metadata', () => {
    const entry = createMockActivityEntry({
      action: 'updated',
      metadata: {
        fromStatus: 'planning',
        toStatus: 'in_progress',
        notes: 'Started implementation',
      },
    })

    expect(entry.metadata).toBeDefined()
    expect(entry.metadata?.fromStatus).toBe('planning')
    expect(entry.metadata?.toStatus).toBe('in_progress')
    expect(entry.metadata?.notes).toBe('Started implementation')
  })

  it('should create entries without optional metadata', () => {
    const entry = createMockActivityEntry({ action: 'created' })
    expect(entry.metadata).toBeUndefined()
  })

  it('should associate activity entries with tasks', () => {
    const task = createMockTask({ title: 'Tracked task' })
    const entry = createMockActivityEntry({
      taskId: task._id,
      action: 'created',
    })

    expect(entry.taskId).toBe(task._id)
  })
})

describe('Activity Log - Timeline Integration Stubs', () => {
  it('should order activity entries by timestamp', () => {
    const now = Date.now()
    const entries = [
      createMockActivityEntry({ action: 'created', timestamp: now - 3000 }),
      createMockActivityEntry({ action: 'claimed', timestamp: now - 2000 }),
      createMockActivityEntry({ action: 'started', timestamp: now - 1000 }),
      createMockActivityEntry({ action: 'completed', timestamp: now }),
    ]

    // Sort by timestamp ascending
    const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp)
    expect(sorted[0].action).toBe('created')
    expect(sorted[1].action).toBe('claimed')
    expect(sorted[2].action).toBe('started')
    expect(sorted[3].action).toBe('completed')
  })

  it('should group activity entries by task', () => {
    const entries = [
      createMockActivityEntry({ taskId: 'task-a', action: 'created' }),
      createMockActivityEntry({ taskId: 'task-a', action: 'started' }),
      createMockActivityEntry({ taskId: 'task-b', action: 'created' }),
    ]

    const grouped: Record<string, MockActivityEntry[]> = {}
    for (const entry of entries) {
      if (!grouped[entry.taskId]) {
        grouped[entry.taskId] = []
      }
      grouped[entry.taskId].push(entry)
    }

    expect(grouped['task-a']).toHaveLength(2)
    expect(grouped['task-b']).toHaveLength(1)
  })

  it('should track complete task lifecycle via activity entries', () => {
    const taskId = 'j57lifecycle'
    const now = Date.now()

    const lifecycle: ActivityAction[] = [
      'created',
      'claimed',
      'started',
      'updated',
      'completed',
    ]

    const entries = lifecycle.map((action, i) =>
      createMockActivityEntry({
        taskId,
        action,
        timestamp: now + i * 1000,
      })
    )

    expect(entries).toHaveLength(5)
    expect(entries[0].action).toBe('created')
    expect(entries[entries.length - 1].action).toBe('completed')
    // All entries belong to the same task
    expect(entries.every((e) => e.taskId === taskId)).toBe(true)
  })

  it('should validate recent activity query response shape', () => {
    const recentActivity = {
      entries: [
        createMockActivityEntry({ action: 'completed' }),
        createMockActivityEntry({ action: 'started' }),
      ],
      limit: 50,
    }

    expect(recentActivity.entries).toHaveLength(2)
    expect(recentActivity.limit).toBe(50)
  })
})
