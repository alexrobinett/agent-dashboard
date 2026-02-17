import { cn } from '../lib/utils'

export type WorkloadData = Record<
  string,
  { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> }
>

export interface WorkloadChartProps {
  data: WorkloadData
}

const STATUS_COLORS: Record<string, string> = {
  ready: '#3B82F6',       // blue
  in_progress: '#F59E0B', // amber
  in_review: '#A855F7',   // purple
  blocked: '#EF4444',     // red
  done: '#22C55E',        // green
  cancelled: '#6B7280',   // gray
  planning: '#8B5CF6',    // violet
}

const OVERLOAD_THRESHOLD = 5

export function WorkloadChart({ data }: WorkloadChartProps) {
  const agents = Object.entries(data)
    .map(([name, entry]) => ({ name, ...entry }))
    .sort((a, b) => b.total - a.total)

  return (
    <div
      data-testid="workload-chart"
      aria-label="Agent workload chart"
      className="mb-6 rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-card-foreground mb-4">Agent Workload</h2>

      {agents.length === 0 ? (
        <p data-testid="workload-chart-empty" className="text-sm text-muted-foreground italic text-center py-4">
          No workload data
        </p>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => {
            const isOverloaded = (agent.byStatus.in_progress || 0) >= OVERLOAD_THRESHOLD

            return (
              <div
                key={agent.name}
                data-testid={`workload-bar-${agent.name}`}
                aria-label={`${agent.name}: ${agent.total} tasks`}
                className="flex items-center gap-3"
              >
                <span className="text-sm font-medium text-foreground w-24 truncate">
                  {agent.name}
                </span>

                <div
                  className={cn(
                    'flex-1 flex h-6 rounded overflow-hidden bg-muted',
                    isOverloaded && 'ring-2 ring-red-500 ring-offset-1 ring-offset-background',
                  )}
                >
                  {Object.entries(agent.byStatus)
                    .filter(([, count]) => count > 0)
                    .map(([status, count]) => {
                      const pct = (count / agent.total) * 100
                      return (
                        <div
                          key={status}
                          data-testid={`workload-segment-${agent.name}-${status}`}
                          aria-label={`${status}: ${count}`}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: STATUS_COLORS[status] || '#6B7280',
                          }}
                          className="h-full transition-all"
                        />
                      )
                    })}
                </div>

                <span className="text-sm text-muted-foreground w-8 text-right tabular-nums">
                  {agent.total}
                </span>

                {isOverloaded && (
                  <span
                    data-testid={`workload-overload-${agent.name}`}
                    className="text-xs font-semibold text-red-500"
                  >
                    Overloaded
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
