import type React from 'react'
import { cn } from '../lib/utils'

export type WorkloadData = Record<
  string,
  { total: number; byStatus: Record<string, number>; byPriority: Record<string, number> }
>

export interface WorkloadChartProps {
  data: WorkloadData
  onAgentClick?: (agent: string) => void
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

export function WorkloadChart({ data, onAgentClick }: WorkloadChartProps) {
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
                className={cn(
                  'flex items-center gap-3',
                  onAgentClick && 'cursor-pointer hover:bg-muted/50 rounded-md px-1 -mx-1',
                )}
                {...(onAgentClick
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      onClick: () => onAgentClick(agent.name),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onAgentClick(agent.name)
                        }
                      },
                    }
                  : {})}
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
                    aria-label={`${agent.name} is overloaded`}
                    className="text-xs font-semibold text-white bg-red-500 rounded-full px-2 py-0.5"
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
