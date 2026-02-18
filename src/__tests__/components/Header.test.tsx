import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, onClick, className, _activeProps, ...props }: any) => (
    <a href={to} onClick={onClick} className={className} {...props}>
      {children}
    </a>
  ),
}))

import Header from '../../components/Header'

describe('Header', () => {
  it('should render without errors', () => {
    render(<Header />)

    const header = document.querySelector('header')
    expect(header).not.toBeNull()
  })

  it('should render the Agent Dashboard branding link to home', () => {
    render(<Header />)

    const brandLink = screen.getByText('Agent Dashboard')
    expect(brandLink).toBeDefined()
    expect(brandLink.closest('a')?.getAttribute('href')).toBe('/')
  })

  it('should render the menu button with accessible label', () => {
    render(<Header />)

    const menuButton = screen.getByLabelText('Open menu')
    expect(menuButton).toBeDefined()
  })

  it('should open sidebar when menu button is clicked', () => {
    render(<Header />)

    const menuButton = screen.getByLabelText('Open menu')
    fireEvent.click(menuButton)

    // Sidebar should now be visible (translated into view)
    const sidebar = document.querySelector('aside')
    expect(sidebar).not.toBeNull()
    expect(sidebar!.className).toContain('translate-x-0')
  })

  it('should close sidebar when close button is clicked', () => {
    render(<Header />)

    // Open the sidebar first
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(document.querySelector('aside')!.className).toContain('translate-x-0')

    // Close it
    fireEvent.click(screen.getByLabelText('Close menu'))
    expect(document.querySelector('aside')!.className).toContain('-translate-x-full')
  })

  it('should render navigation with Home link', () => {
    render(<Header />)

    expect(screen.getByText('Home')).toBeDefined()
  })

  it('should render Navigation heading in sidebar', () => {
    render(<Header />)

    expect(screen.getByText('Navigation')).toBeDefined()
  })

  it('should close sidebar when a nav link is clicked', () => {
    render(<Header />)

    // Open the sidebar
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(document.querySelector('aside')!.className).toContain('translate-x-0')

    // Click the Home link
    fireEvent.click(screen.getByText('Home'))
    expect(document.querySelector('aside')!.className).toContain('-translate-x-full')
  })
})
