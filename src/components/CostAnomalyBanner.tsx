import { useMemo, useState } from 'react'

type Anomaly = {
  category?: string
  project?: string
}

export function CostAnomalyBanner({ anomalies }: { anomalies: Anomaly[] }) {
  const [dismissed, setDismissed] = useState(false)

  const affectedAgents = useMemo(() => {
    const labels = anomalies
      .map((anomaly) => anomaly.category ?? anomaly.project)
      .filter((value): value is string => Boolean(value))
    return Array.from(new Set(labels))
  }, [anomalies])

  if (dismissed || anomalies.length === 0) {
    return null
  }

  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-amber-100"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">⚠️ {anomalies.length} cost anomalies detected</p>
          {affectedAgents.length > 0 && (
            <p className="mt-1 text-sm text-amber-200">Affected agents: {affectedAgents.join(', ')}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-sm text-amber-200 underline underline-offset-2 hover:text-amber-50"
          aria-label="Dismiss anomalies alert"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
