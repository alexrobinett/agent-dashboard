import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'

import {
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  getStoredThemePreference,
  getSystemTheme,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '../lib/theme'

type ThemeContextValue = {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreference] = useState<ThemePreference>(() => getStoredThemePreference())
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme())

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const updateSystemTheme = (event?: MediaQueryListEvent) => {
      setSystemTheme(event?.matches ?? media.matches ? 'dark' : 'light')
    }

    updateSystemTheme()

    media.addEventListener('change', updateSystemTheme)
    return () => media.removeEventListener('change', updateSystemTheme)
  }, [])

  const resolvedTheme: ResolvedTheme = useMemo(
    () => (preference === 'system' ? systemTheme : resolveTheme(preference)),
    [preference, systemTheme],
  )

  useEffect(() => {
    applyResolvedTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    const localStorageValue = window.localStorage as Partial<Storage> | undefined
    if (localStorageValue && typeof localStorageValue.setItem === 'function') {
      localStorageValue.setItem(THEME_STORAGE_KEY, preference)
    }
  }, [preference])

  const value = useMemo(
    () => ({
      preference,
      resolvedTheme,
      setPreference,
    }),
    [preference, resolvedTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
