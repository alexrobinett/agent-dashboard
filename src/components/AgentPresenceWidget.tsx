import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import type { WorkloadData } from './WorkloadChart'

export type AgentPresenceEntry = {
  agent: string
  status?: string
  lastSeen: number
  activeTask?: {
    taskId: string
    taskKey?: string
    title?: string
    project?: string
  }
}

type PresenceState = 'online' | 'busy' | 'offline'

const BUSY_TASK_STATUSES = new Set(['in_progress', 'in_review', 'blocked'])
const ONLINE_WINDOW_MS = 5 * 60 * 1000

function formatStatus(status?: string) {
  return (status ?? 'planning').replace('_', ' ')
}

function derivePresenceState(entry: AgentPresenceEntry, now: number): PresenceState {
  const isRecentlySeen = now - entry.lastSeen <= ONLINE_WINDOW_MS
  if (!isRecentlySeen) return 'offline'
  if (BUSY_TASK_STATUSES.has(entry.status ?? '')) return 'busy'
  return 'online'
}

function formatRelative(msAgo: number) {
  if (msAgo < 30_000) return 'just now'
  const minutes = Math.floor(msAgo / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

const PRESENCE_BADGE_VARIANTS: Record<PresenceState, 'default' | 'secondary' | 'destructive'> = {
  online: 'secondary',
  busy: 'default',
  offline: 'destructive',
}

export function AgentPresenceWidget({
  agents,
  workload,
}: {
  agents: AgentPresenceEntry[]
  workload: WorkloadData
}) {
  const now = Date.now()

  return (
    <Card data-testid="agent-presence-widget" className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Agent Presence</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {agents.length === 0 ? (
          <p data-testid="agent-presence-empty" className="text-sm text-muted-foreground italic">
            No active agent presence data
          </p>
        ) : (
          agents.map((entry) => {
            const state = derivePresenceState(entry, now)
            const workloadForAgent = workload[entry.agent]
            const totalTasks = workloadForAgent?.total ?? 0
            const inProgress = workloadForAgent?.byStatus?.in_progress ?? 0
            const loadPct = totalTasks > 0 ? Math.min(100, Math.round((inProgress / totalTasks) * 100)) : 0

            return (
              <div
                key={entry.agent}
                data-testid={`agent-presence-${entry.agent}`}
                className="rounded-md border border-border bg-background p-3"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{entry.agent}</p>
                    <p className="text-xs text-muted-foreground">
                      Last seen {formatRelative(Math.max(0, now - entry.lastSeen))}
                    </p>
                  </div>
                  <Badge variant={PRESENCE_BADGE_VARIANTS[state]} data-testid={`agent-state-${entry.agent}`}>
                    {state}
                  </Badge>
                </div>

                <p className="text-sm text-muted-foreground" data-testid={`agent-activity-${entry.agent}`}>
                  {entry.activeTask?.taskKey ?? 'Task'}: {entry.activeTask?.title ?? 'No current task'}
                  {' • '}
                  {formatStatus(entry.status)}
                </p>

                <div className="mt-2" data-testid={`agent-workload-${entry.agent}`}>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Workload</span>
                    <span>
                      {inProgress}/{totalTasks} in progress
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${loadPct}%` }} />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
