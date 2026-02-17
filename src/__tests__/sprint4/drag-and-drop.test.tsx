/**
 * Sprint 4: Drag-and-Drop Behavior Tests
 *
 * Tests exercise actual status transition codepaths:
 * - The update mutation handler for status changes
 * - The getByStatus query handler for board state after transitions
 * - The groupTasksByStatus utility for column rendering
 */

import { describe, it, expect } from 'vitest'
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
  const validStatuses: TaskStatus[] = [
    'planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked',
  ]

  it('should update task status from planning to in_progress', async () => {
    const task = makeTask({ _id: 'task-1', status: 'planning' })
    const { ctx, store } = makeMutableCtx([task])

    await updateHandler(ctx, { id: 'task-1', status: 'in_progress' })

    expect(store[0].status).toBe('in_progress')
  })

  it('should transition through all valid statuses', async () => {
    const task = makeTask({ _id: 'task-1', status: 'planning' })
    const { ctx, store } = makeMutableCtx([task])

    for (const targetStatus of validStatuses) {
      await updateHandler(ctx, { id: 'task-1', status: targetStatus })
      expect(store[0].status).toBe(targetStatus)
    }
  })

  it('should preserve other task fields when only status changes (drag)', async () => {
    const task = makeTask({
      _id: 'task-1',
      status: 'planning',
      priority: 'high',
      assignedAgent: 'forge',
      notes: 'Important notes',
    })
    const { ctx, store } = makeMutableCtx([task])

    await updateHandler(ctx, { id: 'task-1', status: 'done' })

    expect(store[0].status).toBe('done')
    expect(store[0].priority).toBe('high')
    expect(store[0].assignedAgent).toBe('forge')
    expect(store[0].notes).toBe('Important notes')
    expect(store[0].title).toBe('Test Task')
  })

  it('should reject invalid status values', async () => {
    const task = makeTask({ _id: 'task-1', status: 'planning' })
    const { ctx } = makeMutableCtx([task])

    await expect(
      updateHandler(ctx, { id: 'task-1', status: 'invalid_status' })
    ).rejects.toThrow(/Invalid status/)
  })

  it('should throw when updating a non-existent task', async () => {
    const { ctx } = makeMutableCtx([])

    await expect(
      updateHandler(ctx, { id: 'nonexistent', status: 'done' })
    ).rejects.toThrow(/Task not found/)
  })

  it('should return success on valid status update', async () => {
    const task = makeTask({ _id: 'task-1', status: 'planning' })
    const { ctx } = makeMutableCtx([task])

    const result = await updateHandler(ctx, { id: 'task-1', status: 'in_review' })
    expect(result).toEqual({ success: true })
  })
})

describe('Drag-and-Drop - Board State via getByStatus', () => {
  it('should reflect task in new column after status update', async () => {
    const tasks = [
      makeTask({ _id: 'task-1', status: 'planning', title: 'Dragged Task' }),
      makeTask({ _id: 'task-2', status: 'done', title: 'Stable Task' }),
    ]
    const { ctx, store } = makeMutableCtx(tasks)

    // Simulate drag: update status
    await updateHandler(ctx, { id: 'task-1', status: 'in_progress' })

    // Read board state — should reflect the mutation
    const board = await getByStatusHandler(ctx, {})

    expect(board.planning).toHaveLength(0)
    expect(board.in_progress).toHaveLength(1)
    expect(board.in_progress[0].title).toBe('Dragged Task')
    expect(board.done).toHaveLength(1)
  })

  it('should handle moving task to an empty column', async () => {
    const tasks = [
      makeTask({ _id: 'task-1', status: 'planning', title: 'Only Task' }),
    ]
    const { ctx, store } = makeMutableCtx(tasks)

    await updateHandler(ctx, { id: 'task-1', status: 'blocked' })
    const board = await getByStatusHandler(ctx, {})

    expect(board.planning).toHaveLength(0)
    expect(board.blocked).toHaveLength(1)
    expect(board.blocked[0].title).toBe('Only Task')
  })

  it('should always return all 6 status columns even when empty', async () => {
    const ctx = makeMutableCtx([]).ctx
    const board = await getByStatusHandler(ctx, {})

    expect(Object.keys(board)).toEqual(
      expect.arrayContaining(['planning', 'ready', 'in_progress', 'in_review', 'done', 'blocked'])
    )
    for (const col of Object.values(board)) {
      expect(col).toHaveLength(0)
    }
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
  })

  it('should move task between columns after status change', () => {
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
})
