import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useRef, useState } from 'react'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { KeyboardShortcutsOverlay } from '../../components/KeyboardShortcutsOverlay'

function KeyboardHarness() {
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [view, setView] = useState<'board' | 'workload'>('workload')
  const searchRef = useRef<HTMLInputElement>(null)

  useKeyboardShortcuts({
    onToggleCommandPalette: () => setPaletteOpen((prev) => !prev),
    onToggleShortcutsHelp: () => setOverlayOpen((prev) => !prev),
    onOpenNewTask: () => setNewTaskOpen(true),
    onFocusSearch: () => searchRef.current?.focus(),
    onEscape: () => {
      setPaletteOpen(false)
      setOverlayOpen(false)
      setNewTaskOpen(false)
    },
    onNavigateDown: () => {},
    onNavigateUp: () => {},
    onGoToBoard: () => setView('board'),
    onGoToWorkload: () => setView('workload'),
    isCommandPaletteOpen: paletteOpen,
  })

  return (
    <div>
      <input ref={searchRef} data-testid="search-input" />
      <input data-testid="secondary-input" />
      <div data-testid="current-view">{view}</div>
      <div data-testid="palette-state">{paletteOpen ? 'open' : 'closed'}</div>
      {newTaskOpen ? <div data-testid="new-task-open" /> : null}
      <KeyboardShortcutsOverlay open={overlayOpen} onOpenChange={setOverlayOpen} />
    </div>
  )
}

describe('useKeyboardShortcuts', () => {
  it('shortcut fires correct action', () => {
    render(<KeyboardHarness />)

    fireEvent.keyDown(window, { key: 'n' })

    expect(screen.getByTestId('new-task-open')).toBeDefined()
  })

  it('overlay opens and closes on ?', () => {
    render(<KeyboardHarness />)

    fireEvent.keyDown(window, { key: '?' })
    expect(screen.getByTestId('keyboard-shortcuts-overlay')).toBeDefined()

    fireEvent.keyDown(window, { key: '?' })
    expect(screen.queryByTestId('keyboard-shortcuts-overlay')).toBeNull()
  })

  it('input fields ignore shortcuts', () => {
    render(<KeyboardHarness />)

    const input = screen.getByTestId('search-input')
    ;(input as HTMLInputElement).focus()

    fireEvent.keyDown(input, { key: 'n' })
    fireEvent.keyDown(input, { key: '?' })
    fireEvent.keyDown(input, { key: 'g' })
    fireEvent.keyDown(input, { key: 'b' })

    expect(screen.queryByTestId('new-task-open')).toBeNull()
    expect(screen.queryByTestId('keyboard-shortcuts-overlay')).toBeNull()
    expect(screen.getByTestId('current-view').textContent).toBe('workload')
  })

  it('g then b navigates to board', () => {
    render(<KeyboardHarness />)

    expect(screen.getByTestId('current-view').textContent).toBe('workload')
    fireEvent.keyDown(window, { key: 'g' })
    fireEvent.keyDown(window, { key: 'b' })

    expect(screen.getByTestId('current-view').textContent).toBe('board')
  })

  it('cmd/ctrl+k toggles command palette state', () => {
    render(<KeyboardHarness />)

    expect(screen.getByTestId('palette-state').textContent).toBe('closed')
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByTestId('palette-state').textContent).toBe('open')

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(screen.getByTestId('palette-state').textContent).toBe('closed')
  })

  it('escape closes command palette when open', () => {
    render(<KeyboardHarness />)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByTestId('palette-state').textContent).toBe('open')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('palette-state').textContent).toBe('closed')
  })
})
