/**
 * src/test-utils/render-helpers.tsx
 * Custom render helpers that wrap @testing-library/react with common providers.
 * Sprint 3: Testing Infrastructure
 */

import React from 'react'
import { render, type RenderOptions, type RenderResult } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Provider wrapper
// ---------------------------------------------------------------------------

interface AllProvidersProps {
  children: React.ReactNode
}

/**
 * AllProviders wraps the component under test with all required context providers.
 * Add new providers here as the app grows (e.g., Router, Theme, QueryClient).
 */
function AllProviders({ children }: AllProvidersProps) {
  return (
    // Add Router / ThemeProvider / etc. here as needed
    <>{children}</>
  )
}

// ---------------------------------------------------------------------------
// Custom render
// ---------------------------------------------------------------------------

/**
 * customRender — drop-in replacement for @testing-library/react `render`.
 * Automatically wraps the component with AllProviders.
 *
 * @example
 * import { renderWithProviders } from '@/test-utils'
 * const { getByTestId } = renderWithProviders(<MyComponent />)
 */
function customRender(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  return render(ui, { wrapper: AllProviders, ...options })
}

export { customRender as renderWithProviders }

// Re-export everything from @testing-library/react for convenience
export * from '@testing-library/react'
// Override render with our custom version
export { customRender as render }
