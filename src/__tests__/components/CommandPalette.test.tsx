import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { CommandPalette, type CommandItem } from '../../components/CommandPalette'

function renderPalette(overrides?: Partial<{ open: boolean; commands: CommandItem[] }>) {
  const onOpenChange = vi.fn()
  const onSelect = vi.fn()

  const commands: CommandItem[] = overrides?.commands ?? [
    {
      id: 'board-view',
      group: 'Navigation',
      label: 'Go to board view',
      subtitle: 'Switch to board',
      keywords: ['board', 'kanban'],
      onSelect,
    },
    {
      id: 'workload-view',
      group: 'Views',
      label: 'Go to workload view',
      subtitle: 'Switch to workload',
      keywords: ['workload', 'capacity'],
      onSelect,
    },
    {
      id: 'new-task',
      group: 'Tasks',
      label: 'Create new task',
      subtitle: 'Open task sheet',
      keywords: ['new', 'task'],
      onSelect,
    },
  ]

  render(
    <CommandPalette
      open={overrides?.open ?? true}
      onOpenChange={onOpenChange}
      commands={commands}
    />,
  )

  return { onOpenChange, onSelect }
}

describe('CommandPalette', () => {
  it('opens and closes with escape', () => {
    const { onOpenChange } = renderPalette()
    expect(screen.getByTestId('command-palette')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('filters commands with fuzzy search', async () => {
    const user = userEvent.setup()
    renderPalette()

    const input = screen.getByTestId('command-palette-input')
    await user.type(input, 'wrkld')

    expect(screen.getByTestId('command-item-workload-view')).toBeInTheDocument()
    expect(screen.queryByTestId('command-item-board-view')).toBeNull()
  })

  it('selects highlighted command with keyboard enter', async () => {
    const user = userEvent.setup()
    const { onOpenChange, onSelect } = renderPalette()
    const input = screen.getByTestId('command-palette-input')

    await user.type(input, 'new')
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('arrow navigation changes highlighted row before selection', () => {
    const { onSelect } = renderPalette()
    const input = screen.getByTestId('command-palette-input')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
