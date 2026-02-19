import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeToggle } from '../../components/ThemeToggle'

const mockUseTheme = vi.fn()

vi.mock('../../components/ThemeProvider', () => ({
  useTheme: () => mockUseTheme(),
}))

describe('ThemeToggle', () => {
  const setPreference = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resets theme preference to system on alt/option-click', () => {
    mockUseTheme.mockReturnValue({
      preference: 'dark',
      resolvedTheme: 'dark',
      setPreference,
    })

    render(<ThemeToggle />)

    fireEvent.click(screen.getByRole('button', { name: /theme:/i }), { altKey: true })

    expect(setPreference).toHaveBeenCalledWith('system')
    expect(setPreference).toHaveBeenCalledTimes(1)
  })

  it.each([
    { preference: 'system', resolvedTheme: 'dark', expected: 'light' },
    { preference: 'system', resolvedTheme: 'light', expected: 'dark' },
    { preference: 'light', resolvedTheme: 'light', expected: 'dark' },
    { preference: 'dark', resolvedTheme: 'dark', expected: 'light' },
  ] as const)(
    'sets next preference from $preference (resolved: $resolvedTheme) to $expected',
    async ({ preference, resolvedTheme, expected }) => {
      const user = userEvent.setup()

      mockUseTheme.mockReturnValue({
        preference,
        resolvedTheme,
        setPreference,
      })

      render(<ThemeToggle />)

      await user.click(screen.getByRole('button', { name: /theme:/i }))

      expect(setPreference).toHaveBeenCalledWith(expected)
      expect(setPreference).toHaveBeenCalledTimes(1)
    },
  )
})
