import { Monitor, Moon, Sun } from 'lucide-react'

import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { preference, resolvedTheme, setPreference } = useTheme()

  const nextPreference =
    preference === 'system' ? (resolvedTheme === 'dark' ? 'light' : 'dark') : preference === 'light' ? 'dark' : 'light'

  const icon =
    preference === 'system' ? (
      <Monitor className="h-4 w-4" />
    ) : resolvedTheme === 'dark' ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Sun className="h-4 w-4" />
    )

  const label =
    preference === 'system'
      ? `Theme: System (${resolvedTheme}). Click to override to ${nextPreference}.`
      : `Theme: ${preference}. Click to switch to ${nextPreference}. Alt/Option-click to reset to system.`

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-secondary"
      onClick={(event) => {
        if (event.altKey) {
          setPreference('system')
          return
        }
        setPreference(nextPreference)
      }}
    >
      {icon}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
