/**
 * Custom Test Render
 * Sprint 3.4: Shared test utilities
 * 
 * Provides custom render function wrapping Convex and Router providers
 */

import React from 'react'
import { render } from '@testing-library/react'
import type { RenderOptions } from '@testing-library/react'
import { ConvexProvider } from 'convex/react'
import { createMockConvexClient } from './mocks/convex'
import type { MockConvexClientOptions } from './mocks/convex'

/**
 * Custom render options extending RTL render options
 */
export interface CustomRenderOptions extends RenderOptions {
  /**
   * Mock Convex query data
   */
  convexOptions?: MockConvexClientOptions
}

/**
 * Custom render function with Convex provider
 * 
 * Wraps components in ConvexProvider with mock client
 * 
 * @param ui - React element to render
 * @param options - Render options
 * @returns RTL render result
 * 
 * @example
 * const { getByText } = renderWithConvex(<MyComponent />, {
 *   convexOptions: {
 *     queryData: {
 *       'tasks:list': mockTasks,
 *     },
 *   },
 * })
 */
export function renderWithConvex(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) {
  const { convexOptions, ...renderOptions } = options
  
  const mockClient = createMockConvexClient(convexOptions)
  
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <ConvexProvider client={mockClient}>{children}</ConvexProvider>
  }
  
  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

/**
 * Re-export everything from RTL for convenience
 */
export * from '@testing-library/react'
