import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    items: [
      { keys: 'j', description: 'Next task card' },
      { keys: 'k', description: 'Previous task card' },
      { keys: 'g b', description: 'Go to board view' },
      { keys: 'g w', description: 'Go to workload view' },
    ],
  },
  {
    title: 'Actions',
    items: [
      { keys: 'n', description: 'Open new task drawer' },
      { keys: '/', description: 'Focus search input' },
      { keys: 'esc', description: 'Close modal or drawer' },
    ],
  },
  {
    title: 'Views',
    items: [{ keys: '?', description: 'Toggle this help overlay' }],
  },
]

interface KeyboardShortcutsOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsOverlay({
  open,
  onOpenChange,
}: KeyboardShortcutsOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="keyboard-shortcuts-overlay">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Global keyboard shortcuts for dashboard navigation and actions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {group.title}
              </h3>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li
                    key={`${group.title}-${item.keys}`}
                    className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2"
                  >
                    <span className="text-sm text-muted-foreground">
                      {item.description}
                    </span>
                    <kbd className="rounded border border-border bg-muted px-2 py-1 text-xs font-semibold uppercase text-foreground">
                      {item.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
