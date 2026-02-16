/**
 * Custom Render Utility Unit Tests
 * Sprint 3.4: Shared test utilities
 */

import { describe, it, expect } from 'vitest'
import { renderWithConvex, screen } from '../render'

function TestComponent({ message }: { message: string }) {
  return <div data-testid="test-message">{message}</div>
}

describe('renderWithConvex', () => {
  it('should render component', () => {
    renderWithConvex(<TestComponent message="Hello World" />)
    
    expect(screen.getByTestId('test-message')).toBeDefined()
    expect(screen.getByText('Hello World')).toBeDefined()
  })

  it('should wrap component in ConvexProvider', () => {
    const { container } = renderWithConvex(<TestComponent message="Test" />)
    
    // Component should render without errors
    expect(container).toBeDefined()
    expect(screen.getByTestId('test-message').textContent).toBe('Test')
  })

  it('should accept convex options', () => {
    renderWithConvex(<TestComponent message="With Options" />, {
      convexOptions: {
        queryData: {
          'tasks:list': [],
        },
      },
    })
    
    expect(screen.getByText('With Options')).toBeDefined()
  })

  it('should accept RTL render options', () => {
    const { container } = renderWithConvex(<TestComponent message="Container Test" />, {
      container: document.body,
    })
    
    expect(container).toBe(document.body)
  })
})
