/**
 * Sprint 4: Activity Log Behavior Tests
 *
 * Tests exercise the actual logActivity mutation handler and
 * getTaskActivity / getRecentActivity query handlers from
 * convex/activityLog.ts, verifying that activity entries are
 * generated with correct timestamps, actions, and metadata.
 */

import { describe, it, expect } from 'vitest'
import * as activityModule from '../../../convex/activityLog'

type HandlerExtractor = { handler: (...args: any[]) => Promise<any> }
const logActivityHandler = (activityModule.logActivity as unknown as HandlerExtractor).handler
const getTaskActivityHandler = (activityModule.getTaskActivity as unknown as HandlerExtractor).handler
const getRecentActivityHandler = (activityModule.getRecentActivity as unknown as HandlerExtractor).handler

// In-memory store simulating Convex DB for activityLog table
function makeMutableCtx() {
  const logs: any[] = []
  let nextId = 1
  return {
    ctx: {
      db: {
        query: (_table: string) => ({
          order: (_dir: string) => ({
            take: async (n: number) => logs.slice(0, n),
            collect: async () => logs,
          }),
        }),
        insert: async (_table: string, doc: Record<string, unknown>) => {
          const id = `log-${nextId++}`
          logs.push({ _id: id, ...doc })
          return id
        },
      },
    },
    logs,
  }
}

describe('Activity Log - logActivity mutation handler', () => {
  it('should create an activity entry with timestamp', async () => {
    const { ctx, logs } = makeMutableCtx()
    const before = Date.now()

    await logActivityHandler(ctx, {
      taskId: 'task-1',
      actor: 'forge',
      actorType: 'agent',
      action: 'created',
    })

    expect(logs).toHaveLength(1)
    expect(logs[0].taskId).toBe('task-1')
    expect(logs[0].actor).toBe('forge')
    expect(logs[0].actorType).toBe('agent')
    expect(logs[0].action).toBe('created')
    expect(logs[0].timestamp).toBeGreaterThanOrEqual(before)
    expect(logs[0].timestamp).toBeLessThanOrEqual(Date.now())
  })

  it('should store status transition metadata', async () => {
    const { ctx, logs } = makeMutableCtx()

    await logActivityHandler(ctx, {
      taskId: 'task-1',
      actor: 'forge',
      actorType: 'agent',
      action: 'updated',
      metadata: {
        fromStatus: 'planning',
        toStatus: 'in_progress',
        notes: 'Started implementation',
      },
    })

    expect(logs[0].metadata).toEqual({
      fromStatus: 'planning',
      toStatus: 'in_progress',
      notes: 'Started implementation',
    })
  })

  it('should store entries without optional metadata', async () => {
    const { ctx, logs } = makeMutableCtx()

    await logActivityHandler(ctx, {
      taskId: 'task-1',
      actor: 'sentinel',
      actorType: 'agent',
      action: 'claimed',
    })

    expect(logs[0].metadata).toBeUndefined()
    expect(logs[0].action).toBe('claimed')
  })

  it('should return the inserted entry ID', async () => {
    const { ctx } = makeMutableCtx()

    const result = await logActivityHandler(ctx, {
      taskId: 'task-1',
      actor: 'forge',
      actorType: 'agent',
      action: 'started',
    })

    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('should record all 7 action types', async () => {
    const { ctx, logs } = makeMutableCtx()
    const actions = ['created', 'claimed', 'started', 'completed', 'updated', 'blocked', 'handed_off']

    for (const action of actions) {
      await logActivityHandler(ctx, {
        taskId: 'task-1',
        actor: 'forge',
        actorType: 'agent',
        action,
      })
    }

    expect(logs).toHaveLength(7)
    const recordedActions = logs.map((l: any) => l.action)
    expect(recordedActions).toEqual(actions)
  })

  it('should record different actor types', async () => {
    const { ctx, logs } = makeMutableCtx()

    await logActivityHandler(ctx, {
      taskId: 'task-1', actor: 'forge', actorType: 'agent', action: 'created',
    })
    await logActivityHandler(ctx, {
      taskId: 'task-1', actor: 'admin', actorType: 'user', action: 'updated',
    })
    await logActivityHandler(ctx, {
      taskId: 'task-1', actor: 'scheduler', actorType: 'system', action: 'started',
    })

    expect(logs[0].actorType).toBe('agent')
    expect(logs[1].actorType).toBe('user')
    expect(logs[2].actorType).toBe('system')
  })
})

describe('Activity Log - Task Lifecycle via logActivity', () => {
  it('should build a complete lifecycle with correct chronological order', async () => {
    const { ctx, logs } = makeMutableCtx()

    // Simulate a full task lifecycle
    const lifecycle = [
      { action: 'created', actor: 'api', actorType: 'system' },
      { action: 'claimed', actor: 'forge', actorType: 'agent' },
      { action: 'started', actor: 'forge', actorType: 'agent', metadata: { fromStatus: 'ready', toStatus: 'in_progress' } },
      { action: 'updated', actor: 'forge', actorType: 'agent', metadata: { fromStatus: 'in_progress', toStatus: 'in_review' } },
      { action: 'completed', actor: 'sentinel', actorType: 'agent', metadata: { fromStatus: 'in_review', toStatus: 'done' } },
    ]

    for (const entry of lifecycle) {
      await logActivityHandler(ctx, { taskId: 'task-lifecycle', ...entry })
    }

    expect(logs).toHaveLength(5)

    // All belong to the same task
    expect(logs.every((l: any) => l.taskId === 'task-lifecycle')).toBe(true)

    // Timestamps should be non-decreasing (all created within same tick or ascending)
    for (let i = 1; i < logs.length; i++) {
      expect(logs[i].timestamp).toBeGreaterThanOrEqual(logs[i - 1].timestamp)
    }

    // First and last actions should be lifecycle boundaries
    expect(logs[0].action).toBe('created')
    expect(logs[logs.length - 1].action).toBe('completed')
  })

  it('should track status transitions with from/to metadata', async () => {
    const { ctx, logs } = makeMutableCtx()

    const transitions = [
      { from: 'planning', to: 'ready' },
      { from: 'ready', to: 'in_progress' },
      { from: 'in_progress', to: 'in_review' },
      { from: 'in_review', to: 'done' },
    ]

    for (const t of transitions) {
      await logActivityHandler(ctx, {
        taskId: 'task-1',
        actor: 'forge',
        actorType: 'agent',
        action: 'updated',
        metadata: { fromStatus: t.from, toStatus: t.to },
      })
    }

    expect(logs).toHaveLength(4)
    // Each entry has matching from/to metadata
    expect(logs[0].metadata.fromStatus).toBe('planning')
    expect(logs[0].metadata.toStatus).toBe('ready')
    expect(logs[3].metadata.fromStatus).toBe('in_review')
    expect(logs[3].metadata.toStatus).toBe('done')

    // Verify chain: each toStatus matches next fromStatus
    for (let i = 0; i < logs.length - 1; i++) {
      expect(logs[i].metadata.toStatus).toBe(logs[i + 1].metadata.fromStatus)
    }
  })
})

describe('Activity Log - Query handlers', () => {
  it('getTaskActivity should filter entries by taskId', async () => {
    const { ctx, logs } = makeMutableCtx()

    // Insert entries for two different tasks
    await logActivityHandler(ctx, {
      taskId: 'task-a', actor: 'forge', actorType: 'agent', action: 'created',
    })
    await logActivityHandler(ctx, {
      taskId: 'task-b', actor: 'sentinel', actorType: 'agent', action: 'created',
    })
    await logActivityHandler(ctx, {
      taskId: 'task-a', actor: 'forge', actorType: 'agent', action: 'started',
    })

    const result = await getTaskActivityHandler(ctx, { taskId: 'task-a' })

    expect(result).toHaveLength(2)
    expect(result.every((l: any) => l.taskId === 'task-a')).toBe(true)
  })

  it('getRecentActivity should return entries up to the limit', async () => {
    const { ctx } = makeMutableCtx()

    for (let i = 0; i < 5; i++) {
      await logActivityHandler(ctx, {
        taskId: `task-${i}`, actor: 'forge', actorType: 'agent', action: 'created',
      })
    }

    const result = await getRecentActivityHandler(ctx, { limit: 3 })
    expect(result).toHaveLength(3)
  })

  it('getRecentActivity should default to limit 50', async () => {
    const { ctx } = makeMutableCtx()

    // Insert 2 entries; should return all since count < default limit
    await logActivityHandler(ctx, {
      taskId: 'task-1', actor: 'forge', actorType: 'agent', action: 'created',
    })
    await logActivityHandler(ctx, {
      taskId: 'task-2', actor: 'sentinel', actorType: 'agent', action: 'started',
    })

    const result = await getRecentActivityHandler(ctx, {})
    expect(result).toHaveLength(2)
  })
})
