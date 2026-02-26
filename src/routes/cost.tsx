import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { useQuery } from 'convex/react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { api } from '../../convex/_generated/api'
import { getSession } from '../lib/auth-middleware'
import { CostAnomalyBanner } from '../components/CostAnomalyBanner'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'

type SortColumn = 'agent' | 'runs' | 'tokens' | 'cost'
type SortDirection = 'asc' | 'desc'

type AnalyticsResponse = {
  period: Array<{ label: string; costUsd: number }>
  categories: Array<{
    category: string
    entries: number
    inputTokens: number
    outputTokens: number
    costUsd: number
  }>
}

type AnomalyResponse = {
  anomalies: Array<{ category?: string; project?: string }>
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export const Route = createFileRoute('/cost')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
  },
  component: CostAnalyticsPage,
})

function CostAnalyticsPage() {
  const [sortColumn, setSortColumn] = useState<SortColumn>('cost')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const endMs = Date.now()
  const startMs = endMs - THIRTY_DAYS_MS
  const queryArgs = { startMs, endMs, granularity: 'day' as const, categoryType: 'agent' as const }

  const analytics = useQuery(api.costTelemetry.getAnalytics, queryArgs) as AnalyticsResponse | undefined
  const anomalyData = useQuery(api.costTelemetry.getAnomalyPrimitives, queryArgs) as AnomalyResponse | undefined

  const chartData = useMemo(() => {
    if (!analytics?.period) {
      return []
    }
    return analytics.period.map((bucket) => ({
      date: bucket.label,
      totalCostUsd: bucket.costUsd,
    }))
  }, [analytics])

  const sortedCategories = useMemo(() => {
    const categories = analytics?.categories ?? []
    const sorted = [...categories].sort((a, b) => {
      if (sortColumn === 'agent') {
        const compare = a.category.localeCompare(b.category)
        return sortDirection === 'asc' ? compare : -compare
      }

      const aValue = sortColumn === 'runs'
        ? a.entries
        : sortColumn === 'tokens'
          ? a.inputTokens + a.outputTokens
          : a.costUsd

      const bValue = sortColumn === 'runs'
        ? b.entries
        : sortColumn === 'tokens'
          ? b.inputTokens + b.outputTokens
          : b.costUsd

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    })

    return sorted
  }, [analytics, sortColumn, sortDirection])

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortColumn(column)
    setSortDirection(column === 'agent' ? 'asc' : 'desc')
  }

  const isLoading = analytics === undefined

  return (
    <div className="min-h-screen bg-background p-6" style={{ backgroundColor: '#0F0F10' }}>
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-6 text-4xl font-bold text-white">Cost Analytics</h1>

        {anomalyData && <CostAnomalyBanner anomalies={anomalyData.anomalies} />}

        <section className="mb-8 rounded-xl border border-white/10 bg-black/20 p-4">
          {isLoading ? (
            <div className="space-y-3" aria-label="cost-chart-loading">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-zinc-400">No cost data yet</div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis dataKey="date" stroke="#A1A1AA" tick={{ fill: '#A1A1AA', fontSize: 12 }} />
                  <YAxis
                    stroke="#A1A1AA"
                    tick={{ fill: '#A1A1AA', fontSize: 12 }}
                    tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181B', border: '1px solid #27272A', color: '#fff' }}
                    formatter={(value) => [`$${Number(value).toFixed(4)}`, 'Cost']}
                  />
                  <Line type="monotone" dataKey="totalCostUsd" stroke="#6366F1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-white/10 bg-black/20 p-4">
          <h2 className="mb-4 text-xl font-semibold text-white">Per-Agent Breakdown</h2>
          {isLoading ? (
            <div className="space-y-2" aria-label="cost-table-loading">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead>
                    <SortButton onClick={() => toggleSort('agent')} label="Agent" />
                  </TableHead>
                  <TableHead>
                    <SortButton onClick={() => toggleSort('runs')} label="Runs" />
                  </TableHead>
                  <TableHead>
                    <SortButton onClick={() => toggleSort('tokens')} label="Tokens" />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton onClick={() => toggleSort('cost')} label="Cost (USD)" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCategories.map((category) => {
                  const tokenCount = category.inputTokens + category.outputTokens
                  return (
                    <TableRow key={category.category} className="border-white/10 text-zinc-200">
                      <TableCell>{category.category}</TableCell>
                      <TableCell>{category.entries.toLocaleString()}</TableCell>
                      <TableCell>{tokenCount.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${category.costUsd.toFixed(4)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </div>
  )
}

function SortButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="h-auto px-0 text-zinc-100 hover:text-white" onClick={onClick}>
      {label}
    </Button>
  )
}
