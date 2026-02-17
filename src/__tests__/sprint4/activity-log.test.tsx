/**
 * Sprint 4: Activity Log Behavior Tests
 *
 * Tests exercise the actual logActivity mutation handler and
 * getTaskActivity / getRecentActivity query handlers from
 * convex/activityLog.ts, verifying that activity entries are
 * generated with correct timestamps, actions, before/after metadata,
 * and that queries filter/limit results correctly.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../convex/_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
}))

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
  it('should create a log entry with correct fields and valid timestamp', async () => {
    const { ctx, logs } = makeMutableCtx()
    const before = Date.now()

    await logActivityHandler(ctx, {
      taskId: 'task-1',
      actor: 'forge',
      actorType: 'agent',
      action: 'created',
    })

    const after = Date.now()
    expect(logs).toHaveLength(1)
    expect(logs[0].taskId).toBe('task-1')
    expect(logs[0].actor).toBe('forge')
    expect(logs[0].actorType).toBe('agent')
    expect(logs[0].action).toBe('created')
    expect(logs[0].timestamp).toBeGreaterThanOrEqual(before)
    expect(logs[0].timestamp).toBeLessThanOrEqual(after)
  })

  it('should store status transition metadata with correct before/after values', async () => {
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

    expect(logs[0].metadata.fromStatus).toBe('planning')
    expect(logs[0].metadata.toStatus).toBe('in_progress')
    expect(logs[0].metadata.notes).toBe('Started implementation')
  })

  it('should handle entries without optional metadata', async () => {
    const { ctx, logs } = makeMutableCtx()

    await logActivityHandler(ctx, {
      taskId: 'task-1',
      actor: 'sentinel',
      actorType: 'agent',
      action: 'claimed',
    })

    expect(logs[0].metadata).toBeUndefined()
    expect(logs[0].action).toBe('claimed')
    expect(logs[0].actor).toBe('sentinel')
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

  it('should record all 7 action types correctly', async () => {
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

  it('should record all 3 actor types correctly', async () => {
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
    expect(logs[0].actor).toBe('forge')
    expect(logs[1].actorType).toBe('user')
    expect(logs[1].actor).toBe('admin')
    expect(logs[2].actorType).toBe('system')
    expect(logs[2].actor).toBe('scheduler')
  })

  it('should generate unique IDs for each log entry', async () => {
    const { ctx } = makeMutableCtx()

    const id1 = await logActivityHandler(ctx, {
      taskId: 'task-1', actor: 'forge', actorType: 'agent', action: 'created',
    })
    const id2 = await logActivityHandler(ctx, {
      taskId: 'task-1', actor: 'forge', actorType: 'agent', action: 'started',
    })

    expect(id1).not.toBe(id2)
  })
})

describe('Activity Log - Task Lifecycle via logActivity', () => {
  it('should build a complete lifecycle with correct chronological order', async () => {
    const { ctx, logs } = makeMutableCtx()

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
    expect(logs.every((l: any) => l.taskId === 'task-lifecycle')).toBe(true)

    // Timestamps should be non-decreasing
    for (let i = 1; i < logs.length; i++) {
      expect(logs[i].timestamp).toBeGreaterThanOrEqual(logs[i - 1].timestamp)
    }

    // First action is creation, last is completion
    expect(logs[0].action).toBe('created')
    expect(logs[logs.length - 1].action).toBe('completed')
  })

  it('should track status transitions with from/to chain that links correctly', async () => {
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

    // Verify the chain links: each toStatus matches next fromStatus
    for (let i = 0; i < logs.length - 1; i++) {
      expect(logs[i].metadata.toStatus).toBe(logs[i + 1].metadata.fromStatus)
    }

    // Verify start and end of the chain
    expect(logs[0].metadata.fromStatus).toBe('planning')
    expect(logs[logs.length - 1].metadata.toStatus).toBe('done')
  })

  it('should track a blocked-then-resumed task lifecycle', async () => {
    const { ctx, logs } = makeMutableCtx()

    await logActivityHandler(ctx, {
      taskId: 'task-blocked',
      actor: 'forge',
      actorType: 'agent',
      action: 'started',
      metadata: { fromStatus: 'ready', toStatus: 'in_progress' },
    })
    await logActivityHandler(ctx, {
      taskId: 'task-blocked',
      actor: 'forge',
      actorType: 'agent',
      action: 'blocked',
      metadata: { fromStatus: 'in_progress', toStatus: 'blocked', notes: 'Waiting for API key' },
    })
    await logActivityHandler(ctx, {
      taskId: 'task-blocked',
      actor: 'forge',
      actorType: 'agent',
      action: 'started',
      metadata: { fromStatus: 'blocked', toStatus: 'in_progress', notes: 'API key received' },
    })

    expect(logs).toHaveLength(3)
    expect(logs[0].metadata.toStatus).toBe('in_progress')
    expect(logs[1].metadata.toStatus).toBe('blocked')
    expect(logs[1].metadata.notes).toBe('Waiting for API key')
    expect(logs[2].metadata.fromStatus).toBe('blocked')
    expect(logs[2].metadata.toStatus).toBe('in_progress')
    expect(logs[2].metadata.notes).toBe('API key received')
  })
})

describe('Activity Log - Query handlers', () => {
  it('getTaskActivity should filter entries by taskId correctly', async () => {
    const { ctx } = makeMutableCtx()

    // Insert entries for three different tasks
    await logActivityHandler(ctx, {
      taskId: 'task-a', actor: 'forge', actorType: 'agent', action: 'created',
    })
    await logActivityHandler(ctx, {
      taskId: 'task-b', actor: 'sentinel', actorType: 'agent', action: 'created',
    })
    await logActivityHandler(ctx, {
      taskId: 'task-a', actor: 'forge', actorType: 'agent', action: 'started',
    })
    await logActivityHandler(ctx, {
      taskId: 'task-c', actor: 'oracle', actorType: 'agent', action: 'claimed',
    })

    const resultA = await getTaskActivityHandler(ctx, { taskId: 'task-a' })
    expect(resultA).toHaveLength(2)
    expect(resultA.every((l: any) => l.taskId === 'task-a')).toBe(true)
    expect(resultA.map((l: any) => l.action)).toContain('created')
    expect(resultA.map((l: any) => l.action)).toContain('started')

    const resultB = await getTaskActivityHandler(ctx, { taskId: 'task-b' })
    expect(resultB).toHaveLength(1)
    expect(resultB[0].taskId).toBe('task-b')
  })

  it('getTaskActivity should return empty for task with no activity', async () => {
    const { ctx } = makeMutableCtx()

    await logActivityHandler(ctx, {
      taskId: 'task-a', actor: 'forge', actorType: 'agent', action: 'created',
    })

    const result = await getTaskActivityHandler(ctx, { taskId: 'task-nonexistent' })
    expect(result).toHaveLength(0)
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

  it('getRecentActivity should return all entries when limit exceeds count', async () => {
    const { ctx } = makeMutableCtx()

    await logActivityHandler(ctx, {
      taskId: 'task-1', actor: 'forge', actorType: 'agent', action: 'created',
    })

    const result = await getRecentActivityHandler(ctx, { limit: 100 })
    expect(result).toHaveLength(1)
  })
})
