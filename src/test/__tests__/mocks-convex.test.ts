/**
 * Convex Mock Provider Unit Tests
 * Sprint 3.4: Shared test utilities
 */

import { describe, it, expect, vi } from 'vitest'
import { createMockConvexClient, mockQueryData } from '../mocks/convex'

describe('createMockConvexClient', () => {
  it('should create mock client with subscribe method', () => {
    const client = createMockConvexClient() as any
    
    expect(client).toHaveProperty('subscribe')
    expect(typeof client.subscribe).toBe('function')
  })

  it('should invoke callback with mock query data', () => {
    const client = createMockConvexClient({
      queryData: {
        'tasks:list': [{ id: '123', title: 'Test Task' }],
      },
    }) as any
    
    const callback = vi.fn()
    client.subscribe({ name: 'tasks:list' }, {}, callback)
    
    expect(callback).toHaveBeenCalledWith([{ id: '123', title: 'Test Task' }])
  })

  it('should return unsubscribe function', () => {
    const client = createMockConvexClient() as any
    
    const callback = vi.fn()
    const subscription = client.subscribe({ name: 'tasks:list' }, {}, callback)
    
    expect(subscription).toHaveProperty('unsubscribe')
    expect(typeof subscription.unsubscribe).toBe('function')
  })

  it('should handle mutations', () => {
    const client = createMockConvexClient({
      mutationResponses: {
        'tasks:create': { _id: 'j57abc123', title: 'Created Task' },
      },
    }) as any
    
    expect(client).toHaveProperty('mutation')
    expect(typeof client.mutation).toBe('function')
  })

  it('should handle actions', () => {
    const client = createMockConvexClient() as any
    
    expect(client).toHaveProperty('action')
    expect(typeof client.action).toBe('function')
  })
})

describe('mockQueryData', () => {
  it('should provide default query data structure', () => {
    expect(mockQueryData).toHaveProperty('tasks:list')
    expect(mockQueryData).toHaveProperty('tasks:getByStatus')
    expect(mockQueryData).toHaveProperty('tasks:getWorkload')
    expect(mockQueryData).toHaveProperty('tasks:listFiltered')
  })

  it('should have empty tasks list by default', () => {
    expect(Array.isArray(mockQueryData['tasks:list'])).toBe(true)
    expect(mockQueryData['tasks:list']).toHaveLength(0)
  })

  it('should have all status columns in getByStatus', () => {
    const byStatus = mockQueryData['tasks:getByStatus']
    
    expect(byStatus).toHaveProperty('planning')
    expect(byStatus).toHaveProperty('ready')
    expect(byStatus).toHaveProperty('in_progress')
    expect(byStatus).toHaveProperty('in_review')
    expect(byStatus).toHaveProperty('done')
    expect(byStatus).toHaveProperty('blocked')
  })

  it('should have valid listFiltered structure', () => {
    const filtered = mockQueryData['tasks:listFiltered']
    
    expect(filtered).toHaveProperty('tasks')
    expect(filtered).toHaveProperty('total')
    expect(filtered).toHaveProperty('limit')
    expect(filtered).toHaveProperty('offset')
    expect(filtered).toHaveProperty('hasMore')
    expect(filtered.limit).toBe(50)
    expect(filtered.offset).toBe(0)
    expect(filtered.hasMore).toBe(false)
  })
})
