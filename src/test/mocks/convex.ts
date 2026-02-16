/**
 * Convex Mock Provider
 * Sprint 3.4: Shared test utilities
 * 
 * Provides mock ConvexProvider and ConvexReactClient for testing
 */

import { vi } from 'vitest'
import { ConvexReactClient } from 'convex/react'

export interface MockConvexClientOptions {
  queryData?: Record<string, any>
  mutationResponses?: Record<string, any>
}

/**
 * Creates a mock Convex client for testing
 * 
 * @param options - Configuration for mock data
 * @returns Mock ConvexReactClient
 */
export function createMockConvexClient(options: MockConvexClientOptions = {}) {
  const { queryData = {}, mutationResponses = {} } = options
  
  const subscribers = new Map<string, (value: unknown) => void>()
  
  const mockClient = {
    subscribe: (
      query: { name: string },
      args: unknown,
      callback: (value: unknown) => void
    ) => {
      const key = `${query.name}:${JSON.stringify(args)}`
      subscribers.set(key, callback)
      
      // Immediately invoke callback with mock data if available
      const queryKey = query.name
      if (queryData[queryKey]) {
        callback(queryData[queryKey])
      }
      
      return {
        unsubscribe: () => subscribers.delete(key),
      }
    },
    mutation: vi.fn((mutationName: string) => {
      return async () => {
        if (mutationResponses[mutationName]) {
          return mutationResponses[mutationName]
        }
        return { success: true }
      }
    }),
    action: vi.fn(),
  }
  
  return mockClient as unknown as ConvexReactClient
}

/**
 * Mock query data for common Convex queries
 */
export const mockQueryData = {
  'tasks:list': [],
  'tasks:getByStatus': {
    planning: [],
    ready: [],
    in_progress: [],
    in_review: [],
    done: [],
    blocked: [],
  },
  'tasks:getWorkload': {},
  'tasks:listFiltered': {
    tasks: [],
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  },
}
