import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, vi } from 'vitest'

import { ThemeProvider, useTheme } from '../../components/ThemeProvider'
import { THEME_STORAGE_KEY, getThemeInitScript } from '../../lib/theme'

function ThemeHarness() {
  const { preference, resolvedTheme, setPreference } = useTheme()

  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button onClick={() => setPreference('dark')}>dark</button>
      <button onClick={() => setPreference('light')}>light</button>
      <button onClick={() => setPreference('system')}>system</button>
    </div>
  )
}

describe('theme system', () => {
  beforeEach(() => {
    vi.restoreAllMocks()

    const store = new Map<string, string>()
    const localStorageMock: Storage = {
      length: 0,
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => {
        store.delete(key)
      },
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    }

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    })

    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''
  })

  it('defaults to system theme and resolves to dark when OS prefers dark', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string): MediaQueryList => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }))

    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('preference')).toHaveTextContent('system')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('persists manual override and ignores system preference while set', async () => {
    const user = userEvent.setup()

    vi.spyOn(window, 'matchMedia').mockImplementation((query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }))

    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'dark' }))

    expect(screen.getByTestId('preference')).toHaveTextContent('dark')
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('emits hydration-safe init script with storage key and system query', () => {
    const script = getThemeInitScript()

    expect(script).toContain(THEME_STORAGE_KEY)
    expect(script).toContain('prefers-color-scheme: dark')
    expect(script).toContain("classList.toggle('dark'")
  })
})
