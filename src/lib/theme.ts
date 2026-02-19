export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'agent-dashboard-theme'

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system'

  const localStorageValue = window.localStorage as Partial<Storage> | undefined
  if (!localStorageValue || typeof localStorageValue.getItem !== 'function') {
    return 'system'
  }

  const value = localStorageValue.getItem(THEME_STORAGE_KEY)
  return isThemePreference(value) ? value : 'system'
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light'

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return getSystemTheme()
  }

  return preference
}

export function applyResolvedTheme(theme: ResolvedTheme) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
}

export function getThemeInitScript() {
  return `(() => {
    try {
      const storageKey = '${THEME_STORAGE_KEY}';
      const stored = localStorage.getItem(storageKey);
      const preference = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
      const root = document.documentElement;
      root.classList.toggle('dark', resolved === 'dark');
      root.style.colorScheme = resolved;
    } catch {}
  })();`
}
