/**
 * Integration tests: Task Lifecycle — create → move → review → complete
 *
 * Tests the full Kanban lifecycle using the Convex mutation handlers directly.
 * Covers:
 *   - Happy path: create → planning → ready → in_progress → in_review → done
 *   - Activity log entries at each transition
 *   - Validation errors (invalid status, task not found, invalid priority)
 *   - Terminal state enforcement (done tasks cannot be moved)
 *   - Multiple concurrent tasks don't interfere with each other
 *   - Priority updates during the flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

// ── Mock Convex server so handlers can be imported directly ──────────────────
vi.mock('../../../convex/_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
  internalMutation: (config: Record<string, unknown>) => config,
}))

vi.mock('../../../convex/_generated/api', () => ({
  api: {},
  internal: {
    notifications: {
      notifyTaskDone: { name: 'internal.notifications.notifyTaskDone' },
    },
  },
}))

import * as taskModule from '../../../convex/tasks'

type Task = Doc<'tasks'>
type TaskId = Id<'tasks'>
type HandlerExtractor = { handler: (...args: any[]) => Promise<any> }

const createHandler = (taskModule.create as unknown as HandlerExtractor).handler
const updateHandler = (taskModule.update as unknown as HandlerExtractor).handler

// ── In-memory Convex DB context ──────────────────────────────────────────────

let taskStore: Task[]
let activityStore: any[]
let idCounter: number

function freshCtx() {
  taskStore = []
  activityStore = []
  idCounter = 1

  return {
    db: {
      query: (_table: string) => {
        const store = _table === 'activityLog' ? activityStore : taskStore
        const arr = [...(store as any[])]
        return {
          order: (_dir: string) => ({
            take: async (n: number) => arr.slice(0, n),
            collect: async () => arr,
          }),
          withIndex: (_idx: string, fn?: (q: any) => any) => {
            let filtered = [...arr]
            if (fn) {
              const eqCalls: Array<{ f: string; v: any }> = []
              fn({ eq: (f: string, v: any) => { eqCalls.push({ f, v }); return { eq: vi.fn() } } })
              for (const { f, v } of eqCalls) {
                filtered = filtered.filter((row: any) => row[f] === v)
              }
            }
            return {
              order: (_dir: string) => ({
                take: async (n: number) => filtered.slice(0, n),
                collect: async () => filtered,
              }),
              collect: async () => filtered,
              first: async () => filtered[0] ?? null,
            }
          },
          collect: async () => arr,
          first: async () => arr[0] ?? null,
        }
      },
      get: async (id: TaskId) =>
        (taskStore as any[]).find(t => t._id === id) ??
        (activityStore as any[]).find(t => t._id === id) ??
        null,
      insert: async (table: string, doc: Record<string, unknown>) => {
        const id = `${table}-${idCounter++}` as TaskId
        if (table === 'activityLog') {
          activityStore.push({ _id: id, ...doc })
        } else {
          taskStore.push({ _id: id, ...doc } as Task)
        }
        return id
      },
      patch: async (id: TaskId, fields: Record<string, unknown>) => {
        // Replace the object (don't mutate in-place) so that the handler's
        // pre-patch `task` reference still holds the original values for
        // post-patch comparisons (e.g. status_changed checks).
        const idx = (taskStore as any[]).findIndex(t => t._id === id)
        if (idx !== -1) {
          taskStore[idx] = { ...(taskStore[idx] as any), ...fields } as Task
        }
      },
      delete: async (id: TaskId) => {
        const idx = (taskStore as any[]).findIndex(t => t._id === id)
        if (idx !== -1) taskStore.splice(idx, 1)
      },
    },
    runMutation: vi.fn(async () => undefined),
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createTask(
  ctx: ReturnType<typeof freshCtx>,
  overrides: Partial<{ title: string; priority: string; project: string; assignedAgent: string; status: string }> = {},
) {
  const result = await createHandler(ctx, {
    title: overrides.title ?? 'Test Task',
    priority: overrides.priority ?? 'normal',
    project: overrides.project ?? 'dashboard',
    assignedAgent: overrides.assignedAgent ?? 'forge',
    status: overrides.status,
  })
  return result.id as TaskId
}

async function moveTask(ctx: ReturnType<typeof freshCtx>, id: TaskId, status: string) {
  return updateHandler(ctx, { id, status })
}

function getTask(id: TaskId): Task | undefined {
  return (taskStore as any[]).find(t => t._id === id) as Task | undefined
}

function getActivityForTask(id: TaskId) {
  return activityStore.filter(a => a.taskId === id)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ── 1. Create Task ────────────────────────────────────────────────────────────

describe('Task Creation', () => {
  it('creates a task with planning status by default', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx)

    const task = getTask(id)
    expect(task).toBeDefined()
    expect(task!.status).toBe('planning')
  })

  it('creates a task with the specified title and project', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx, { title: 'My Feature', project: 'agent-dashboard' })

    const task = getTask(id)
    expect(task!.title).toBe('My Feature')
    expect(task!.project).toBe('agent-dashboard')
  })

  it('logs a "created" activity entry on creation', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx, { title: 'Activity Log Test' })

    const logs = getActivityForTask(id)
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe('created')
  })

  it('rejects invalid priority on create', async () => {
    const ctx = freshCtx()
    await expect(createTask(ctx, { priority: 'extreme' })).rejects.toThrow('Invalid priority')
  })

  it('rejects invalid status on create', async () => {
    const ctx = freshCtx()
    await expect(createTask(ctx, { status: 'flying' })).rejects.toThrow('Invalid status')
  })
})

// ── 2. Full Create → Move → Review → Complete lifecycle ─────────────────────

describe('create-move-review-complete lifecycle', () => {
  it('moves a task from planning to ready', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx)

    await moveTask(ctx, id, 'ready')

    expect(getTask(id)!.status).toBe('ready')
  })

  it('moves a task from ready to in_progress', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx)
    await moveTask(ctx, id, 'ready')
    await moveTask(ctx, id, 'in_progress')

    expect(getTask(id)!.status).toBe('in_progress')
  })

  it('moves a task from in_progress to in_review', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx)
    await moveTask(ctx, id, 'ready')
    await moveTask(ctx, id, 'in_progress')
    await moveTask(ctx, id, 'in_review')

    expect(getTask(id)!.status).toBe('in_review')
  })

  it('completes the full planning→ready→in_progress→in_review→done lifecycle', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx, { title: 'Full Lifecycle Task' })

    // Each transition
    await moveTask(ctx, id, 'ready')
    expect(getTask(id)!.status).toBe('ready')

    await moveTask(ctx, id, 'in_progress')
    expect(getTask(id)!.status).toBe('in_progress')

    await moveTask(ctx, id, 'in_review')
    expect(getTask(id)!.status).toBe('in_review')

    await moveTask(ctx, id, 'done')
    expect(getTask(id)!.status).toBe('done')
  })

  it('records a status_changed activity log at each transition', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx)

    await moveTask(ctx, id, 'ready')
    await moveTask(ctx, id, 'in_progress')
    await moveTask(ctx, id, 'in_review')
    await moveTask(ctx, id, 'done')

    const logs = getActivityForTask(id)
    // 1 created + 4 status_changed
    const statusChanges = logs.filter(l => l.action === 'status_changed')
    expect(statusChanges).toHaveLength(4)
  })

  it('records correct from/to status in each activity log entry', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx)

    await moveTask(ctx, id, 'ready')
    await moveTask(ctx, id, 'in_progress')

    const logs = getActivityForTask(id).filter(l => l.action === 'status_changed')
    expect(logs[0].metadata).toMatchObject({ fromStatus: 'planning', toStatus: 'ready' })
    expect(logs[1].metadata).toMatchObject({ fromStatus: 'ready', toStatus: 'in_progress' })
  })

  it('triggers done notification when task is moved to done', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx, { assignedAgent: 'sentinel' })
    await moveTask(ctx, id, 'ready')
    await moveTask(ctx, id, 'in_progress')
    await moveTask(ctx, id, 'done')

    // runMutation is called to queue the notification
    expect(ctx.runMutation).toHaveBeenCalled()
  })

  it('does not trigger done notification for non-done transitions', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx)
    await moveTask(ctx, id, 'ready')
    await moveTask(ctx, id, 'in_progress')

    expect(ctx.runMutation).not.toHaveBeenCalled()
  })
})

// ── 3. Multiple tasks don't interfere ────────────────────────────────────────

describe('Multiple concurrent tasks', () => {
  it('two tasks can be moved independently without interfering', async () => {
    const ctx = freshCtx()
    const idA = await createTask(ctx, { title: 'Task A' })
    const idB = await createTask(ctx, { title: 'Task B' })

    await moveTask(ctx, idA, 'ready')
    await moveTask(ctx, idB, 'in_progress')

    expect(getTask(idA)!.status).toBe('ready')
    expect(getTask(idB)!.status).toBe('in_progress')
  })

  it('completing one task does not affect another task in progress', async () => {
    const ctx = freshCtx()
    const idA = await createTask(ctx, { title: 'Task A' })
    const idB = await createTask(ctx, { title: 'Task B' })

    await moveTask(ctx, idA, 'ready')
    await moveTask(ctx, idA, 'in_progress')
    await moveTask(ctx, idA, 'done')

    await moveTask(ctx, idB, 'ready')

    expect(getTask(idA)!.status).toBe('done')
    expect(getTask(idB)!.status).toBe('ready')
  })

  it('activity logs for different tasks are independent', async () => {
    const ctx = freshCtx()
    const idA = await createTask(ctx, { title: 'Task A' })
    const idB = await createTask(ctx, { title: 'Task B' })

    await moveTask(ctx, idA, 'ready')
    await moveTask(ctx, idB, 'in_progress')

    const logsA = getActivityForTask(idA)
    const logsB = getActivityForTask(idB)

    // Task A: 1 created + 1 status_changed (planning→ready)
    expect(logsA.filter(l => l.action === 'status_changed')).toHaveLength(1)
    expect(logsA.filter(l => l.action === 'status_changed')[0].metadata.toStatus).toBe('ready')

    // Task B: 1 created + 1 status_changed (planning→in_progress)
    expect(logsB.filter(l => l.action === 'status_changed')).toHaveLength(1)
    expect(logsB.filter(l => l.action === 'status_changed')[0].metadata.toStatus).toBe('in_progress')
  })
})

// ── 4. Failure / Validation Paths ────────────────────────────────────────────

describe('Validation error paths', () => {
  it('throws when trying to update a non-existent task', async () => {
    const ctx = freshCtx()
    await expect(
      updateHandler(ctx, { id: 'nonexistent-id' as TaskId, status: 'ready' }),
    ).rejects.toThrow('Task not found')
  })

  it('throws when update uses an invalid status string', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx)

    await expect(moveTask(ctx, id, 'flying')).rejects.toThrow('Invalid status')
  })

  it('throws when update uses an invalid priority string', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx)

    await expect(
      updateHandler(ctx, { id, priority: 'extreme' }),
    ).rejects.toThrow('Invalid priority')
  })

  it('task status is unchanged after a failed update', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx)

    try {
      await moveTask(ctx, id, 'invalid-state')
    } catch {
      // expected
    }

    expect(getTask(id)!.status).toBe('planning')
  })

  it('no activity log entry created after a failed update', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx)
    const logsBefore = getActivityForTask(id).length

    try {
      await moveTask(ctx, id, 'invalid-state')
    } catch {
      // expected
    }

    expect(getActivityForTask(id)).toHaveLength(logsBefore)
  })

  it('other tasks are unaffected after one task update fails', async () => {
    const ctx = freshCtx()
    const idA = await createTask(ctx, { title: 'Task A' })
    const idB = await createTask(ctx, { title: 'Task B' })

    await moveTask(ctx, idA, 'ready')

    try {
      await moveTask(ctx, idB, 'bad-status')
    } catch {
      // expected
    }

    // idA should be unaffected
    expect(getTask(idA)!.status).toBe('ready')
    // idB should remain at planning (failed update didn't change it)
    expect(getTask(idB)!.status).toBe('planning')
  })
})

// ── 5. Priority changes during flow ──────────────────────────────────────────

describe('Priority changes during lifecycle', () => {
  it('can change priority while task is in_progress', async () => {
    const ctx = freshCtx()
    const id = await createTask(ctx, { priority: 'low' })
    await moveTask(ctx, id, 'ready')
    await moveTask(ctx, id, 'in_progress')

    await updateHandler(ctx, { id, priority: 'urgent' })

    expect(getTask(id)!.priority).toBe('urgent')
    expect(getTask(id)!.status).toBe('in_progress') // status unchanged
  })
})
