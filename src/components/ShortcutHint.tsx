import { cn } from '../lib/utils'

interface ShortcutHintProps {
  keys: string
  className?: string
}

export function ShortcutHint({ keys, className }: ShortcutHintProps) {
  return (
    <kbd
      aria-hidden="true"
      className={cn(
        'pointer-events-none inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100',
        className,
      )}
    >
      {keys}
    </kbd>
  )
}
