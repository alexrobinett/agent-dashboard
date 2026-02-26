import { describe, it, expect, vi } from 'vitest'

vi.mock('../_generated/server', () => ({
  query: (config: Record<string, unknown>) => config,
  mutation: (config: Record<string, unknown>) => config,
  internalMutation: (config: Record<string, unknown>) => config,
}))

import * as taskModule from '../tasks'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerExtractor = { handler: (...args: any[]) => Promise<any> }
const searchTasksHandler = (taskModule.searchTasks as unknown as HandlerExtractor).handler

// ──────────────────────────────────────────────────────────
// Mock ctx builder
// ──────────────────────────────────────────────────────────
function makeCtx(tasks: Array<Record<string, unknown>>) {
  return {
    db: {
      query: (_table: string) => ({
        order: (_dir: string) => ({
          take: async (n: number) => tasks.slice(0, n),
          paginate: async ({ numItems, cursor }: { numItems: number; cursor: string | null }) => {
            const offset = cursor ? Number.parseInt(cursor, 10) : 0
            const page = tasks.slice(offset, offset + numItems)
            return { page, continueCursor: String(offset + page.length), isDone: page.length < numItems }
          },
        }),
      }),
    },
  }
}

describe('searchTasks query', () => {
  it('returns empty array for empty query', async () => {
    const ctx = makeCtx([
      { _id: 'id1', title: 'Fix bug', description: 'Something', createdAt: 1000 },
    ])
    const result = await searchTasksHandler(ctx, { query: '' })
    expect(result).toEqual([])
  })

  it('returns empty array for whitespace-only query', async () => {
    const ctx = makeCtx([
      { _id: 'id1', title: 'Fix bug', description: 'Something', createdAt: 1000 },
    ])
    const result = await searchTasksHandler(ctx, { query: '   ' })
    expect(result).toEqual([])
  })

  it('returns matching results for a valid query (title match)', async () => {
    const tasks = [
      { _id: 'id1', title: 'Fix the login bug', description: '', createdAt: 2000 },
      { _id: 'id2', title: 'Update readme', description: '', createdAt: 1000 },
    ]
    const ctx = makeCtx(tasks)
    const result = await searchTasksHandler(ctx, { query: 'login' })
    expect(result).toHaveLength(1)
    expect(result[0]._id).toBe('id1')
  })

  it('returns matching results for description match', async () => {
    const tasks = [
      { _id: 'id1', title: 'Task A', description: 'needs authentication work', createdAt: 2000 },
      { _id: 'id2', title: 'Task B', description: 'unrelated', createdAt: 1000 },
    ]
    const ctx = makeCtx(tasks)
    const result = await searchTasksHandler(ctx, { query: 'authentication' })
    expect(result).toHaveLength(1)
    expect(result[0]._id).toBe('id1')
  })

  it('respects limit of 20 results', async () => {
    // Create 30 matching tasks
    const tasks = Array.from({ length: 30 }, (_, i) => ({
      _id: `id${i}`,
      title: `search term task ${i}`,
      description: '',
      createdAt: i,
    }))
    const ctx = makeCtx(tasks)
    const result = await searchTasksHandler(ctx, { query: 'search term' })
    expect(result.length).toBeLessThanOrEqual(20)
  })

  it('returns results sorted by createdAt descending', async () => {
    const tasks = [
      { _id: 'id1', title: 'search alpha', description: '', createdAt: 1000 },
      { _id: 'id2', title: 'search beta', description: '', createdAt: 3000 },
      { _id: 'id3', title: 'search gamma', description: '', createdAt: 2000 },
    ]
    const ctx = makeCtx(tasks)
    const result = await searchTasksHandler(ctx, { query: 'search' })
    expect(result[0]._id).toBe('id2')
    expect(result[1]._id).toBe('id3')
    expect(result[2]._id).toBe('id1')
  })
})
