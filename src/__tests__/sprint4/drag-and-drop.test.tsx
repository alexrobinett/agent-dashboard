/**
 * Sprint 4: Drag-and-Drop Behavior Tests
 *
 * Tests exercise actual status transition codepaths:
 * - The update mutation handler for status changes (simulating drag-and-drop)
 * - The getByStatus query handler for board state after transitions
 * - The groupTasksByStatus utility for column rendering
 * - Invalid transition rejection and error handling
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../convex/_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
  internalMutation: (config: Record<string, unknown>) => config,
}))

import { groupTasksByStatus, createMockTask } from '../../test/fixtures'
import type { TaskStatus } from '../../test/fixtures'
import * as taskModule from '../../../convex/tasks'

type HandlerExtractor = { handler: (...args: any[]) => Promise<any> }
const updateHandler = (taskModule.update as unknown as HandlerExtractor).handler
const getByStatusHandler = (taskModule.getByStatus as unknown as HandlerExtractor).handler

// In-memory task store for mutation tests
function makeMutableCtx(tasks: any[]) {
  const store = [...tasks]
  return {
    ctx: {
      db: {
        query: (_table: string) => ({
          order: (_dir: string) => ({
            take: async (n: number) => store.slice(0, n),
          }),
        }),
        get: async (id: string) => store.find((t) => t._id === id) ?? null,
        patch: async (id: string, fields: Record<string, unknown>) => {
          const task = store.find((t) => t._id === id)
          if (task) Object.assign(task, fields)
        },
        insert: async () => 'log-stub',
      },
    },
    store,
  }
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    _id: `j57${Math.random().toString(36).slice(2, 10)}`,
    _creationTime: Date.now(),
    title: 'Test Task',
    status: 'planning',
    priority: 'normal',
    assignedAgent: 'forge',
    project: 'agent-dashboard',
    createdBy: 'test',
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('Drag-and-Drop - Status Transitions via update handler', () => {
  const allValidStatuses = [
    'planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked', 'cancelled',
  ]

  it('should update task from ready to in_progress (typical kanban drag)', async () => {
    const task = makeTask({ _id: 'task-1', status: 'ready' })
    const { ctx, store } = makeMutableCtx([task])

    const result = await updateHandler(ctx, { id: 'task-1', status: 'in_progress' })

    expect(result).toEqual({ success: true })
    expect(store[0].status).toBe('in_progress')
  })

  it('should update task from in_progress to in_review', async () => {
    const task = makeTask({ _id: 'task-1', status: 'in_progress' })
    const { ctx, store } = makeMutableCtx([task])

    await updateHandler(ctx, { id: 'task-1', status: 'in_review' })
    expect(store[0].status).toBe('in_review')
  })

  it('should transition through all 7 valid statuses sequentially', async () => {
    const task = makeTask({ _id: 'task-1', status: 'planning' })
    const { ctx, store } = makeMutableCtx([task])

    for (const targetStatus of allValidStatuses) {
      await updateHandler(ctx, { id: 'task-1', status: targetStatus })
      expect(store[0].status).toBe(targetStatus)
    }
  })

  it('should preserve all other task fields when only status changes (drag)', async () => {
    const task = makeTask({
      _id: 'task-1',
      status: 'planning',
      title: 'Important Feature',
      priority: 'high',
      assignedAgent: 'forge',
      notes: 'Critical path item',
      project: 'agent-dashboard',
    })
    const { ctx, store } = makeMutableCtx([task])

    await updateHandler(ctx, { id: 'task-1', status: 'done' })

    expect(store[0].status).toBe('done')
    expect(store[0].title).toBe('Important Feature')
    expect(store[0].priority).toBe('high')
    expect(store[0].assignedAgent).toBe('forge')
    expect(store[0].notes).toBe('Critical path item')
    expect(store[0].project).toBe('agent-dashboard')
  })

  it('should reject invalid status values with descriptive error', async () => {
    const task = makeTask({ _id: 'task-1', status: 'planning' })
    const { ctx } = makeMutableCtx([task])

    await expect(
      updateHandler(ctx, { id: 'task-1', status: 'invalid_status' })
    ).rejects.toThrow(/Invalid status/)
  })

  it('should reject another invalid status value', async () => {
    const task = makeTask({ _id: 'task-1', status: 'ready' })
    const { ctx } = makeMutableCtx([task])

    await expect(
      updateHandler(ctx, { id: 'task-1', status: 'completed' })
    ).rejects.toThrow(/Invalid status/)
  })

  it('should throw Task not found for non-existent task', async () => {
    const { ctx } = makeMutableCtx([])

    await expect(
      updateHandler(ctx, { id: 'nonexistent', status: 'done' })
    ).rejects.toThrow(/Task not found/)
  })

  it('should reject invalid priority values during drag+priority change', async () => {
    const task = makeTask({ _id: 'task-1', status: 'planning' })
    const { ctx } = makeMutableCtx([task])

    await expect(
      updateHandler(ctx, { id: 'task-1', priority: 'critical' })
    ).rejects.toThrow(/Invalid priority/)
  })

  it('should allow simultaneous status and priority update', async () => {
    const task = makeTask({ _id: 'task-1', status: 'planning', priority: 'normal' })
    const { ctx, store } = makeMutableCtx([task])

    await updateHandler(ctx, { id: 'task-1', status: 'in_progress', priority: 'urgent' })

    expect(store[0].status).toBe('in_progress')
    expect(store[0].priority).toBe('urgent')
  })

  it('should allow reassigning agent during status transition', async () => {
    const task = makeTask({ _id: 'task-1', status: 'in_progress', assignedAgent: 'forge' })
    const { ctx, store } = makeMutableCtx([task])

    await updateHandler(ctx, { id: 'task-1', status: 'in_review', assignedAgent: 'sentinel' })

    expect(store[0].status).toBe('in_review')
    expect(store[0].assignedAgent).toBe('sentinel')
  })

  it('should not mutate tasks other than the targeted one', async () => {
    const task1 = makeTask({ _id: 'task-1', status: 'planning', title: 'Task A' })
    const task2 = makeTask({ _id: 'task-2', status: 'ready', title: 'Task B' })
    const task3 = makeTask({ _id: 'task-3', status: 'done', title: 'Task C' })
    const { ctx, store } = makeMutableCtx([task1, task2, task3])

    await updateHandler(ctx, { id: 'task-2', status: 'in_progress' })

    expect(store[0].status).toBe('planning')
    expect(store[1].status).toBe('in_progress')
    expect(store[2].status).toBe('done')
  })
})

describe('Drag-and-Drop - Board State via getByStatus', () => {
  it('should reflect task in new column after status update', async () => {
    const tasks = [
      makeTask({ _id: 'task-1', status: 'planning', title: 'Dragged Task' }),
      makeTask({ _id: 'task-2', status: 'done', title: 'Stable Task' }),
    ]
    const { ctx } = makeMutableCtx(tasks)

    // Simulate drag: update status
    await updateHandler(ctx, { id: 'task-1', status: 'in_progress' })

    // Read board state — should reflect the mutation
    const board = await getByStatusHandler(ctx, {})

    expect(board.planning).toHaveLength(0)
    expect(board.in_progress).toHaveLength(1)
    expect(board.in_progress[0].title).toBe('Dragged Task')
    expect(board.done).toHaveLength(1)
    expect(board.done[0].title).toBe('Stable Task')
  })

  it('should correctly move task through multiple columns', async () => {
    const tasks = [
      makeTask({ _id: 'task-1', status: 'planning', title: 'Moving Task' }),
    ]
    const { ctx } = makeMutableCtx(tasks)

    // planning -> ready
    await updateHandler(ctx, { id: 'task-1', status: 'ready' })
    let board = await getByStatusHandler(ctx, {})
    expect(board.planning).toHaveLength(0)
    expect(board.ready).toHaveLength(1)

    // ready -> in_progress
    await updateHandler(ctx, { id: 'task-1', status: 'in_progress' })
    board = await getByStatusHandler(ctx, {})
    expect(board.ready).toHaveLength(0)
    expect(board.in_progress).toHaveLength(1)

    // in_progress -> done
    await updateHandler(ctx, { id: 'task-1', status: 'done' })
    board = await getByStatusHandler(ctx, {})
    expect(board.in_progress).toHaveLength(0)
    expect(board.done).toHaveLength(1)
    expect(board.done[0].title).toBe('Moving Task')
  })

  it('should always return all 6 status columns even when empty', async () => {
    const ctx = makeMutableCtx([]).ctx
    const board = await getByStatusHandler(ctx, {})

    const expectedColumns = ['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked']
    expect(Object.keys(board).sort()).toEqual(expectedColumns.sort())
    for (const col of Object.values(board)) {
      expect(col).toHaveLength(0)
    }
  })

  it('should place multiple tasks in same column correctly', async () => {
    const tasks = [
      makeTask({ _id: 'task-1', status: 'in_progress', title: 'Task A' }),
      makeTask({ _id: 'task-2', status: 'in_progress', title: 'Task B' }),
      makeTask({ _id: 'task-3', status: 'done', title: 'Task C' }),
    ]
    const { ctx } = makeMutableCtx(tasks)

    const board = await getByStatusHandler(ctx, {})
    expect(board.in_progress).toHaveLength(2)
    expect(board.done).toHaveLength(1)
    const titles = board.in_progress.map((t: any) => t.title).sort()
    expect(titles).toEqual(['Task A', 'Task B'])
  })
})

describe('Drag-and-Drop - groupTasksByStatus utility', () => {
  it('should correctly partition tasks into status columns', () => {
    const tasks = [
      createMockTask({ status: 'planning', title: 'A' }),
      createMockTask({ status: 'planning', title: 'B' }),
      createMockTask({ status: 'in_progress', title: 'C' }),
      createMockTask({ status: 'done', title: 'D' }),
    ]
    const grouped = groupTasksByStatus(tasks)

    expect(grouped['planning']).toHaveLength(2)
    expect(grouped['in_progress']).toHaveLength(1)
    expect(grouped['done']).toHaveLength(1)
    expect(grouped['ready']).toHaveLength(0)
    expect(grouped['in_review']).toHaveLength(0)
    expect(grouped['blocked']).toHaveLength(0)

    // Verify actual task data is in the right buckets
    expect(grouped['planning'].map(t => t.title).sort()).toEqual(['A', 'B'])
    expect(grouped['in_progress'][0].title).toBe('C')
    expect(grouped['done'][0].title).toBe('D')
  })

  it('should move task between columns after simulated drag (status change + regroup)', () => {
    const tasks = [
      createMockTask({ status: 'planning', title: 'Moving' }),
      createMockTask({ status: 'planning', title: 'Staying' }),
      createMockTask({ status: 'done', title: 'Finished' }),
    ]

    const before = groupTasksByStatus(tasks)
    expect(before['planning']).toHaveLength(2)
    expect(before['in_progress']).toHaveLength(0)

    // Simulate drag by changing status and regrouping
    const updated = tasks.map((t) =>
      t.title === 'Moving' ? { ...t, status: 'in_progress' as TaskStatus } : t
    )
    const after = groupTasksByStatus(updated)

    expect(after['planning']).toHaveLength(1)
    expect(after['planning'][0].title).toBe('Staying')
    expect(after['in_progress']).toHaveLength(1)
    expect(after['in_progress'][0].title).toBe('Moving')
    expect(after['done']).toHaveLength(1)
  })

  it('should handle all tasks in one column', () => {
    const tasks = [
      createMockTask({ status: 'blocked', title: 'X' }),
      createMockTask({ status: 'blocked', title: 'Y' }),
    ]
    const grouped = groupTasksByStatus(tasks)

    expect(grouped['blocked']).toHaveLength(2)
    // All other columns should be empty
    expect(grouped['planning']).toHaveLength(0)
    expect(grouped['ready']).toHaveLength(0)
    expect(grouped['in_progress']).toHaveLength(0)
    expect(grouped['in_review']).toHaveLength(0)
    expect(grouped['done']).toHaveLength(0)
  })
})
