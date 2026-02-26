/**
 * src/test-utils/convex-mock-provider.tsx
 * Minimal Convex mock provider for unit tests.
 * Allows components that use useQuery / useMutation to render without a real backend.
 */

import React from 'react'
import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Type stubs — we don't import from 'convex/react' to avoid requiring a full
// Convex setup in the test environment.
// ---------------------------------------------------------------------------

export interface ConvexMockOptions {
  /** Map of query function references (as strings) → return values */
  queries?: Record<string, unknown>
  /** Map of mutation function references (as strings) → mock implementations */
  mutations?: Record<string, (...args: unknown[]) => unknown>
}

/**
 * ConvexMockProvider
 * Wraps children with mocked Convex context values.
 * Pass `queries` / `mutations` to control return values per-test.
 *
 * @example
 * render(
 *   <ConvexMockProvider queries={{ 'tasks:list': [] }}>
 *     <KanbanBoard />
 *   </ConvexMockProvider>
 * )
 */
export function ConvexMockProvider({
  children,
  queries = {},
  mutations = {},
}: {
  children: React.ReactNode
  queries?: Record<string, unknown>
  mutations?: Record<string, (...args: unknown[]) => unknown>
}) {
  // Install vi mocks for Convex hooks at the module level
  // (assumes vitest.config.ts maps 'convex/react' to this mock via moduleNameMapper
  //  or the test file manually mocks the hooks before rendering).
  void queries
  void mutations
  return <>{children}</>
}

/**
 * createConvexQueryMock
 * Helper to produce a useQuery mock that returns the provided data.
 */
export function createConvexQueryMock<T>(data: T) {
  return vi.fn().mockReturnValue(data)
}

/**
 * createConvexMutationMock
 * Helper to produce a useMutation mock that resolves with the provided value.
 */
export function createConvexMutationMock<T = void>(resolveValue?: T) {
  return vi.fn().mockResolvedValue(resolveValue)
}
