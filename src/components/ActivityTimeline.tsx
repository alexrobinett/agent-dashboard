import { Badge } from './ui/badge'
import { cn } from '../lib/utils'

export interface ActivityEntry {
  _id: string
  taskId: string
  actor: string
  actorType: 'agent' | 'user' | 'system'
  action: string
  metadata?: {
    fromStatus?: string
    toStatus?: string
    notes?: string
  }
  timestamp: number
}

export interface ActivityTimelineProps {
  entries: ActivityEntry[]
}

const ACTOR_TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  agent: 'default',
  user: 'secondary',
  system: 'outline',
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts)
  return date.toLocaleString()
}

export function ActivityTimeline({ entries }: ActivityTimelineProps) {
  const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp)

  return (
    <div
      data-testid="activity-timeline"
      aria-label="Activity timeline"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <h3 className="text-lg font-semibold text-card-foreground mb-4">Activity</h3>

      {sorted.length === 0 ? (
        <p
          data-testid="activity-timeline-empty"
          className="text-sm text-muted-foreground italic text-center py-4"
        >
          No activity yet
        </p>
      ) : (
        <ol role="list" className="space-y-3">
          {sorted.map((entry) => (
            <li
              key={entry._id}
              data-testid={`activity-entry-${entry._id}`}
              className="flex flex-col gap-1 border-l-2 border-border pl-4 py-1"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">
                  {entry.actor}
                </span>
                <Badge variant={ACTOR_TYPE_VARIANT[entry.actorType] ?? 'outline'}>
                  {entry.actorType}
                </Badge>
                <span className={cn(
                  'text-sm font-semibold',
                  entry.action === 'blocked' && 'text-destructive',
                  entry.action === 'completed' && 'text-green-500',
                )}>
                  {entry.action}
                </span>
              </div>

              {entry.metadata?.fromStatus && entry.metadata?.toStatus && (
                <span className="text-xs text-muted-foreground">
                  {entry.metadata.fromStatus} → {entry.metadata.toStatus}
                </span>
              )}

              {entry.metadata?.notes && (
                <span className="text-xs text-muted-foreground italic">
                  {entry.metadata.notes}
                </span>
              )}

              <time
                data-testid={`activity-timestamp-${entry._id}`}
                className="text-xs text-muted-foreground"
              >
                {formatTimestamp(entry.timestamp)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
