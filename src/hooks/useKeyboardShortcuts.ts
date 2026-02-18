import { useEffect, useRef } from 'react'

interface UseKeyboardShortcutsOptions {
  onToggleShortcutsHelp: () => void
  onOpenNewTask: () => void
  onFocusSearch: () => void
  onEscape: () => void
  onNavigateDown: () => void
  onNavigateUp: () => void
  onGoToBoard: () => void
  onGoToWorkload: () => void
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  if (target.isContentEditable) return true

  const tag = target.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true

  return target.closest('[contenteditable="true"]') !== null
}

export function useKeyboardShortcuts({
  onToggleShortcutsHelp,
  onOpenNewTask,
  onFocusSearch,
  onEscape,
  onNavigateDown,
  onNavigateUp,
  onGoToBoard,
  onGoToWorkload,
}: UseKeyboardShortcutsOptions) {
  const pendingChordRef = useRef<string | null>(null)
  const chordTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const clearChord = () => {
      pendingChordRef.current = null
      if (chordTimeoutRef.current !== null) {
        window.clearTimeout(chordTimeoutRef.current)
        chordTimeoutRef.current = null
      }
    }

    const setChord = (prefix: string) => {
      pendingChordRef.current = prefix
      if (chordTimeoutRef.current !== null) {
        window.clearTimeout(chordTimeoutRef.current)
      }
      chordTimeoutRef.current = window.setTimeout(clearChord, 1200)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isEditableElement(event.target)) return

      const key = event.key.toLowerCase()

      if (pendingChordRef.current === 'g') {
        if (key === 'b') {
          event.preventDefault()
          onGoToBoard()
          clearChord()
          return
        }
        if (key === 'w') {
          event.preventDefault()
          onGoToWorkload()
          clearChord()
          return
        }
        clearChord()
      }

      if (key === 'g') {
        event.preventDefault()
        setChord('g')
        return
      }

      if (event.key === '?') {
        event.preventDefault()
        onToggleShortcutsHelp()
        return
      }

      if (key === 'n') {
        event.preventDefault()
        onOpenNewTask()
        return
      }

      if (event.key === '/') {
        event.preventDefault()
        onFocusSearch()
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        clearChord()
        onEscape()
        return
      }

      if (key === 'j') {
        event.preventDefault()
        onNavigateDown()
        return
      }

      if (key === 'k') {
        event.preventDefault()
        onNavigateUp()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (chordTimeoutRef.current !== null) {
        window.clearTimeout(chordTimeoutRef.current)
      }
    }
  }, [
    onEscape,
    onFocusSearch,
    onGoToBoard,
    onGoToWorkload,
    onNavigateDown,
    onNavigateUp,
    onOpenNewTask,
    onToggleShortcutsHelp,
  ])
}
