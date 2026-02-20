import { useEffect, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'

import { cn } from '../lib/utils'

const GROUP_ORDER = ['Navigation', 'Tasks', 'Agents', 'Views', 'Quick Actions'] as const

export type CommandGroup = (typeof GROUP_ORDER)[number]

export interface CommandItem {
  id: string
  group: CommandGroup
  label: string
  subtitle?: string
  keywords: string[]
  shortcut?: string
  enabled?: boolean
  onSelect: () => void
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: CommandItem[]
}

interface ScoredCommand {
  item: CommandItem
  score: number
}

function fuzzyScore(item: CommandItem, query: string): number {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return 1

  const haystack = `${item.label} ${item.subtitle ?? ''} ${item.keywords.join(' ')}`.toLowerCase()

  if (haystack.includes(normalizedQuery)) {
    return 200 - haystack.indexOf(normalizedQuery)
  }

  let queryIndex = 0
  let sequentialMatches = 0
  for (let i = 0; i < haystack.length && queryIndex < normalizedQuery.length; i += 1) {
    if (haystack[i] === normalizedQuery[queryIndex]) {
      queryIndex += 1
      sequentialMatches += 1
    }
  }

  if (queryIndex !== normalizedQuery.length) return 0

  const densityPenalty = Math.max(haystack.length - sequentialMatches, 0)
  return 100 - densityPenalty
}

export function CommandPalette({ open, onOpenChange, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const visibleCommands = useMemo<ScoredCommand[]>(() => {
    return commands
      .map((item) => ({ item, score: fuzzyScore(item, query) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
  }, [commands, query])

  const groupedCommands = useMemo(() => {
    return GROUP_ORDER.map((group) => ({
      group,
      entries: visibleCommands.filter((entry) => entry.item.group === group),
    })).filter((group) => group.entries.length > 0)
  }, [visibleCommands])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIndex(0)
      return
    }
    setActiveIndex(0)
  }, [open, query])

  const runCommand = (entry: ScoredCommand | undefined) => {
    if (!entry || entry.item.enabled === false) return
    entry.item.onSelect()
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-slate-950/72 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <Dialog.Content
          data-testid="command-palette"
          className="fixed left-1/2 top-[18vh] z-50 w-[min(94vw,44rem)] -translate-x-1/2 rounded-xl border border-slate-700/70 bg-slate-950/96 shadow-[0_24px_72px_-28px_rgba(2,6,23,0.9)] outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Search and run dashboard commands.
          </Dialog.Description>
          <div className="border-b border-slate-700/80 px-3 py-3 sm:px-4">
            <input
              data-testid="command-palette-input"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setActiveIndex((current) => Math.min(current + 1, visibleCommands.length - 1))
                  return
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActiveIndex((current) => Math.max(current - 1, 0))
                  return
                }
                if (event.key === 'Enter') {
                  event.preventDefault()
                  runCommand(visibleCommands[activeIndex])
                }
              }}
              placeholder="Type a command or search..."
              className="h-10 w-full rounded-lg border border-slate-600/80 bg-slate-900/80 px-3 text-sm text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            />
          </div>
          <div
            role="listbox"
            aria-label="Command results"
            className="max-h-[min(60vh,28rem)] overflow-y-auto p-2 sm:p-3"
          >
            {groupedCommands.length === 0 && (
              <div className="rounded-lg border border-slate-700/70 px-3 py-5 text-center text-sm text-slate-300">
                No matching commands
              </div>
            )}
            {groupedCommands.map((group) => (
              <section key={group.group} className="mb-2 last:mb-0">
                <h3 className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  {group.group}
                </h3>
                <ul className="space-y-1">
                  {group.entries.map((entry) => {
                    const currentIndex = visibleCommands.findIndex(
                      (candidate) => candidate.item.id === entry.item.id,
                    )
                    const selected = currentIndex === activeIndex
                    const disabled = entry.item.enabled === false

                    return (
                      <li key={entry.item.id}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={selected}
                          aria-disabled={disabled}
                          data-testid={`command-item-${entry.item.id}`}
                          disabled={disabled}
                          onMouseEnter={() => setActiveIndex(currentIndex)}
                          onClick={() => runCommand(entry)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition',
                            selected
                              ? 'border-indigo-300/80 bg-indigo-500/18 shadow-[0_0_0_1px_rgba(129,140,248,0.35)]'
                              : 'border-slate-700/70 bg-slate-900/80 hover:border-slate-500/80 hover:bg-slate-900',
                            disabled && 'cursor-not-allowed opacity-45',
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-100">
                              {entry.item.label}
                            </span>
                            {entry.item.subtitle && (
                              <span className="block truncate text-xs text-slate-300">
                                {entry.item.subtitle}
                              </span>
                            )}
                          </span>
                          {entry.item.shortcut && (
                            <span className="ml-3 rounded border border-slate-600 bg-slate-950/85 px-1.5 py-0.5 text-[11px] text-slate-300">
                              {entry.item.shortcut}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
