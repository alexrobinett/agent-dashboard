import { describe, expect, it, vi } from 'vitest'
import type { Id } from '../_generated/dataModel'

const { notifyTaskDoneRef, getUserTokensRef } = vi.hoisted(() => ({
  notifyTaskDoneRef: { name: 'internal.notifications.notifyTaskDone' },
  getUserTokensRef: { name: 'api.pushTokens.getUserTokens' },
}))

vi.mock('../_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
  internalMutation: (config: Record<string, unknown>) => config,
}))

vi.mock('../_generated/api', () => ({
  api: {
    pushTokens: {
      getUserTokens: getUserTokensRef,
    },
  },
  internal: {
    notifications: {
      notifyTaskDone: notifyTaskDoneRef,
    },
  },
}))

import * as notificationsModule from '../notifications'
import * as tasksModule from '../tasks'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerExtractor = { handler: (...args: any[]) => Promise<any> }
const notifyTaskDoneHandler = (notificationsModule.notifyTaskDone as unknown as HandlerExtractor).handler
const completeTaskHandler = (tasksModule.completeTask as unknown as HandlerExtractor).handler

describe('notifications.notifyTaskDone', () => {
  it('queues push intent when the assigned agent has a token', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_750_000_000_000)
    const insert = vi.fn(async () => 'log-1')
    const runQuery = vi.fn(async () => [{ _id: 'tok-1', token: 'abc' }])
    const ctx = {
      db: { insert },
      runQuery,
    }

    const result = await notifyTaskDoneHandler(ctx, {
      taskId: 'task-1' as Id<'tasks'>,
      agentName: 'forge',
    })

    expect(result).toEqual({ queued: true })
    expect(runQuery).toHaveBeenCalledWith(getUserTokensRef, { userId: 'forge' })
    expect(insert).toHaveBeenCalledWith('activityLog', {
      type: 'push_queued',
      taskId: 'task-1',
      actor: 'system',
      actorType: 'system',
      action: 'updated',
      metadata: {
        notes: 'Queued push notification for forge',
      },
      timestamp: 1_750_000_000_000,
    })
  })

  it('does not queue when the assigned agent has no token', async () => {
    const insert = vi.fn(async () => 'log-1')
    const runQuery = vi.fn(async () => [])
    const ctx = {
      db: { insert },
      runQuery,
    }

    const result = await notifyTaskDoneHandler(ctx, {
      taskId: 'task-1' as Id<'tasks'>,
      agentName: 'forge',
    })

    expect(result).toEqual({ queued: false })
    expect(runQuery).toHaveBeenCalledWith(getUserTokensRef, { userId: 'forge' })
    expect(insert).not.toHaveBeenCalled()
  })
})

describe('tasks completion trigger', () => {
  it('calls notifyTaskDone when completeTask transitions to done', async () => {
    const runMutation = vi.fn(async () => undefined)
    const ctx = {
      db: {
        get: async () => ({
          _id: 'task-1',
          status: 'in_review',
          assignedAgent: 'forge',
          version: 2,
        }),
        patch: async () => undefined,
      },
      runMutation,
    }

    await completeTaskHandler(ctx, { taskId: 'task-1' as Id<'tasks'> })

    expect(runMutation).toHaveBeenCalledWith(notifyTaskDoneRef, {
      taskId: 'task-1',
      agentName: 'forge',
    })
  })
})
