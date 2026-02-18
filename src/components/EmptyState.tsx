import { Inbox, SearchX } from 'lucide-react'

interface EmptyStateProps {
  /** "no-data" for genuinely empty views, "no-results" for filtered/search views */
  variant?: 'no-data' | 'no-results'
  title?: string
  description?: string
}

export function EmptyState({
  variant = 'no-data',
  title,
  description,
}: EmptyStateProps) {
  const isNoResults = variant === 'no-results'
  const Icon = isNoResults ? SearchX : Inbox

  const defaultTitle = isNoResults ? 'No results found' : 'No tasks yet'
  const defaultDescription = isNoResults
    ? 'Try adjusting your filters or search query.'
    : 'Tasks will appear here once they are created.'

  return (
    <div
      data-testid={`empty-state-${variant}`}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <Icon className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <h3 className="text-sm font-medium text-foreground mb-1">
        {title ?? defaultTitle}
      </h3>
      <p className="text-xs text-muted-foreground max-w-[240px]">
        {description ?? defaultDescription}
      </p>
    </div>
  )
}
