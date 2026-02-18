import { describe, it, expect, vi } from 'vitest'
import type { Id } from '../_generated/dataModel'

// ──────────────────────────────────────────────────────────
// Mock convex server so we can import activityLog.ts and tasks.ts
// ──────────────────────────────────────────────────────────
vi.mock('../_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
}))

import * as activityModule from '../activityLog'
import * as taskModule from '../tasks'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerExtractor = { handler: (...args: any[]) => Promise<any> }
const logActivityHandler = (activityModule.logActivity as unknown as HandlerExtractor).handler
const getTaskActivityHandler = (activityModule.getTaskActivity as unknown as HandlerExtractor).handler

const createHandler = (taskModule.create as unknown as HandlerExtractor).handler
const updateHandler = (taskModule.update as unknown as HandlerExtractor).handler
const removeHandler = (taskModule.remove as unknown as HandlerExtractor).handler

type TaskId = Id<'tasks'>

// ──────────────────────────────────────────────────────────
// Helper: build a mock Convex context with in-memory storage
// ──────────────────────────────────────────────────────────
function makeMutableCtx(initialTasks: Record<string, unknown>[] = []) {
  const logs: any[] = []
  const tasks: any[] = [...initialTasks]
  let nextLogId = 1
  let nextTaskId = 1

  return {
    ctx: {
      db: {
        query: (table: string) => {
          const makeChain = (rows: any[]) => ({
            withIndex: (_indexName: string, indexFn?: (q: any) => any) => {
              let filtered = [...rows]
              if (indexFn) {
                const eqCalls: Array<{ field: string; value: unknown }> = []
                const chain = {
                  eq: (field: string, value: unknown) => {
                    eqCalls.push({ field, value })
                    return chain
                  },
                }
                indexFn(chain)
                for (const call of eqCalls) {
                  filtered = filtered.filter((row) => row[call.field] === call.value)
                }
              }
              return makeChain(filtered)
            },
            order: (_dir: string) => ({
              take: async (n: number) => rows.slice(0, n),
              collect: async () => rows,
            }),
          })
          return makeChain(table === 'activityLog' ? logs : tasks)
        },
        get: async (id: string) => tasks.find(t => t._id === id) ?? null,
        insert: async (table: string, doc: Record<string, unknown>) => {
          if (table === 'activityLog') {
            const id = `log-${nextLogId++}`
            logs.push({ _id: id, ...doc })
            return id
          }
          const id = `task-${nextTaskId++}` as TaskId
          tasks.push({ _id: id, _creationTime: Date.now(), ...doc })
          return id
        },
        patch: async (id: string, fields: Record<string, unknown>) => {
          const idx = tasks.findIndex(t => t._id === id)
          if (idx !== -1) {
            tasks[idx] = { ...tasks[idx], ...fields }
          }
        },
        delete: async (id: string) => {
          const idx = tasks.findIndex(t => t._id === id)
          if (idx !== -1) {
            tasks.splice(idx, 1)
          }
        },
      },
    },
    logs,
    tasks,
  }
}

// ──────────────────────────────────────────────────────────
// logActivity mutation tests
// ──────────────────────────────────────────────────────────
describe('logActivity mutation', () => {
  it('should create entry with correct fields', async () => {
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

  it('should store status transition metadata (from/to)', async () => {
    const { ctx, logs } = makeMutableCtx()

    await logActivityHandler(ctx, {
      taskId: 'task-1',
      actor: 'forge',
      actorType: 'agent',
      action: 'status_changed',
      metadata: {
        fromStatus: 'planning',
        toStatus: 'in_progress',
        notes: 'Started work',
      },
    })

    expect(logs[0].metadata.fromStatus).toBe('planning')
    expect(logs[0].metadata.toStatus).toBe('in_progress')
    expect(logs[0].metadata.notes).toBe('Started work')
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
  })

  it('should record all action types', async () => {
    const { ctx, logs } = makeMutableCtx()
    const actions = [
      'created', 'claimed', 'started', 'completed', 'updated',
      'blocked', 'handed_off', 'status_changed', 'deleted',
      'assigned', 'commented', 'priority_changed',
    ]

    for (const action of actions) {
      await logActivityHandler(ctx, {
        taskId: 'task-1',
        actor: 'forge',
        actorType: 'agent',
        action,
      })
    }

    expect(logs).toHaveLength(actions.length)
    const recordedActions = logs.map((l: any) => l.action)
    expect(recordedActions).toEqual(actions)
  })

  it('should record all actor types (user, agent, system)', async () => {
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

  it('should generate unique IDs for each entry', async () => {
    const { ctx } = makeMutableCtx()

    const id1 = await logActivityHandler(ctx, {
      taskId: 'task-1', actor: 'forge', actorType: 'agent', action: 'created',
    })
    const id2 = await logActivityHandler(ctx, {
      taskId: 'task-1', actor: 'forge', actorType: 'agent', action: 'started',
    })

    expect(id1).not.toBe(id2)
    expect(typeof id1).toBe('string')
    expect(typeof id2).toBe('string')
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
})

// ──────────────────────────────────────────────────────────
// getTaskActivity (getByTask) query tests
// ──────────────────────────────────────────────────────────
describe('getTaskActivity query (getByTask)', () => {
  it('should return entries for a specific task', async () => {
    const { ctx } = makeMutableCtx()

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

  it('should return empty array for task with no activity', async () => {
    const { ctx } = makeMutableCtx()

    await logActivityHandler(ctx, {
      taskId: 'task-a', actor: 'forge', actorType: 'agent', action: 'created',
    })

    const result = await getTaskActivityHandler(ctx, { taskId: 'task-nonexistent' })
    expect(result).toHaveLength(0)
  })
})

// ──────────────────────────────────────────────────────────
// Task mutation activity log wiring tests
// ──────────────────────────────────────────────────────────
describe('Task create mutation logs activity', () => {
  it('should log a created entry when a task is created', async () => {
    const { ctx, logs } = makeMutableCtx()

    await createHandler(ctx, {
      title: 'New Task',
      priority: 'high',
      project: 'test-proj',
      createdBy: 'admin',
    })

    const createLog = logs.find((l: any) => l.action === 'created')
    expect(createLog).toBeDefined()
    expect(createLog.actor).toBe('admin')
    expect(createLog.actorType).toBe('user')
    expect(createLog.metadata).toBeDefined()
    expect(createLog.metadata.notes).toContain('New Task')
  })

  it('should use system actor when createdBy defaults to api', async () => {
    const { ctx, logs } = makeMutableCtx()

    await createHandler(ctx, {
      title: 'API Task',
      priority: 'normal',
      project: 'test-proj',
    })

    const createLog = logs.find((l: any) => l.action === 'created')
    expect(createLog).toBeDefined()
    expect(createLog.actor).toBe('api')
    expect(createLog.actorType).toBe('system')
  })
})

describe('Task update mutation logs activity', () => {
  it('should log status_changed when status is updated', async () => {
    const { ctx, logs } = makeMutableCtx([
      {
        _id: 'u1' as TaskId,
        _creationTime: Date.now(),
        title: 'Task To Update',
        status: 'planning',
        priority: 'normal',
        createdBy: 'test',
        createdAt: Date.now(),
      },
    ])

    await updateHandler(ctx, { id: 'u1' as TaskId, status: 'in_progress' })

    const statusLog = logs.find((l: any) => l.action === 'status_changed')
    expect(statusLog).toBeDefined()
    expect(statusLog.metadata.fromStatus).toBe('planning')
    expect(statusLog.metadata.toStatus).toBe('in_progress')
  })

  it('should log updated when non-status fields change', async () => {
    const { ctx, logs } = makeMutableCtx([
      {
        _id: 'u2' as TaskId,
        _creationTime: Date.now(),
        title: 'Task',
        status: 'planning',
        priority: 'normal',
        createdBy: 'test',
        createdAt: Date.now(),
      },
    ])

    await updateHandler(ctx, { id: 'u2' as TaskId, notes: 'Updated notes' })

    const updateLog = logs.find((l: any) => l.action === 'updated')
    expect(updateLog).toBeDefined()
    expect(updateLog.metadata.notes).toContain('notes')
  })

  it('should log priority_changed when priority is updated', async () => {
    const { ctx, logs } = makeMutableCtx([
      {
        _id: 'u3' as TaskId,
        _creationTime: Date.now(),
        title: 'Task',
        status: 'planning',
        priority: 'normal',
        createdBy: 'test',
        createdAt: Date.now(),
      },
    ])

    await updateHandler(ctx, { id: 'u3' as TaskId, priority: 'urgent' })

    const priorityLog = logs.find((l: any) => l.action === 'priority_changed')
    expect(priorityLog).toBeDefined()
    expect(priorityLog.metadata.fromStatus).toBe('normal')
    expect(priorityLog.metadata.toStatus).toBe('urgent')
  })
})

describe('Task delete mutation logs activity', () => {
  it('should log a deleted entry when a task is removed', async () => {
    const { ctx, logs, tasks } = makeMutableCtx([
      {
        _id: 'd1' as TaskId,
        _creationTime: Date.now(),
        title: 'Task To Delete',
        status: 'blocked',
        priority: 'low',
        createdBy: 'test',
        createdAt: Date.now(),
      },
    ])

    await removeHandler(ctx, { id: 'd1' as TaskId })

    expect(tasks).toHaveLength(0)
    const deleteLog = logs.find((l: any) => l.action === 'deleted')
    expect(deleteLog).toBeDefined()
    expect(deleteLog.taskId).toBe('d1')
    expect(deleteLog.metadata.notes).toContain('Task To Delete')
  })

  it('should throw when deleting non-existent task', async () => {
    const { ctx } = makeMutableCtx()

    await expect(removeHandler(ctx, { id: 'missing' as TaskId }))
      .rejects.toThrow('Task not found')
  })
})

// ──────────────────────────────────────────────────────────
// Full lifecycle test: create → update → status_change → delete
// ──────────────────────────────────────────────────────────
describe('Activity log lifecycle', () => {
  it('should produce correct log chain for create → update → status_change → delete', async () => {
    const { ctx, logs } = makeMutableCtx()

    // Create
    const result = await createHandler(ctx, {
      title: 'Lifecycle Task',
      priority: 'high',
      project: 'test-proj',
      createdBy: 'admin',
    })
    const taskId = result.id

    // Update notes
    await updateHandler(ctx, { id: taskId, notes: 'Added context' })

    // Status change
    await updateHandler(ctx, { id: taskId, status: 'in_progress' })

    // Delete
    await removeHandler(ctx, { id: taskId })

    // Verify log chain
    const taskLogs = logs.filter((l: any) => l.taskId === taskId)
    expect(taskLogs.length).toBeGreaterThanOrEqual(4)

    const actions = taskLogs.map((l: any) => l.action)
    expect(actions[0]).toBe('created')
    expect(actions).toContain('updated')
    expect(actions).toContain('status_changed')
    expect(actions[actions.length - 1]).toBe('deleted')

    // All timestamps should be non-decreasing
    for (let i = 1; i < taskLogs.length; i++) {
      expect(taskLogs[i].timestamp).toBeGreaterThanOrEqual(taskLogs[i - 1].timestamp)
    }
  })
})
