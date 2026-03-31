'use client'

import { useState } from 'react'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import type { RelativePerformanceRow } from '@/types/analytics'
import { ChartCard, LoadingState, ErrorState } from './shared'

const METRIC_LABELS: Record<string, string> = {
  views: 'Views',
  listens: 'Listens',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  watch_time: 'Watch Time',
}

// green (#1) to soft yellow (#10)
function rankBg(rank: number) {
  const t = Math.min((rank - 1) / 9, 1)
  const r = Math.round(220 + t * (254 - 220))
  const g = Math.round(252 + t * (243 - 252))
  const b = Math.round(231 + t * (199 - 231))
  return `rgb(${r}, ${g}, ${b})`
}

export function RelativePerformanceChart() {
  const { data, loading, error } = useAnalyticsData<RelativePerformanceRow>('relative-performance')
  const [sortMetric, setSortMetric] = useState<string | null>('views')

  if (loading) return <ChartCard title="Relative Performance"><LoadingState /></ChartCard>
  if (error || !data) return <ChartCard title="Relative Performance"><ErrorState error={error} /></ChartCard>

  const windowDays = data[0]?.window_days ?? 0
  const metrics = Array.from(new Set(data.map((r) => r.metric)))

  // group by episode
  const episodeMap = new Map<string, Map<string, RelativePerformanceRow>>()
  for (const row of data) {
    if (!episodeMap.has(row.episode_id)) episodeMap.set(row.episode_id, new Map())
    episodeMap.get(row.episode_id)!.set(row.metric, row)
  }

  // sort episodes by selected metric rank
  let episodeIds = Array.from(episodeMap.keys())
  if (sortMetric) {
    episodeIds.sort((a, b) => {
      const ra = episodeMap.get(a)?.get(sortMetric)?.rank ?? 999
      const rb = episodeMap.get(b)?.get(sortMetric)?.rank ?? 999
      return ra - rb
    })
  }

  return (
    <ChartCard
      title="Relative Performance"
      subtitle={`Latest 10 episodes, first ${windowDays} days after publish`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-2 pr-3 font-medium">Episode</th>
              {metrics.map((m) => (
                <th
                  key={m}
                  className={`pb-2 px-2 font-medium text-center cursor-pointer select-none hover:text-gray-900 transition-colors ${
                    sortMetric === m ? 'text-gray-900' : ''
                  }`}
                  onClick={() => setSortMetric(sortMetric === m ? null : m)}
                >
                  {METRIC_LABELS[m] || m}
                  {sortMetric === m && <span className="ml-1">&#9660;</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {episodeIds.map((epId) => {
              const metricMap = episodeMap.get(epId)!
              return (
                <tr key={epId} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 pr-3 font-mono text-xs">{epId}</td>
                  {metrics.map((m) => {
                    const row = metricMap.get(m)
                    if (!row) return <td key={m} className="px-2 text-center">-</td>
                    const isSorted = sortMetric === m
                    return (
                      <td
                        key={m}
                        className={`py-2 px-2 text-center transition-colors ${
                          isSorted ? 'font-semibold text-gray-900' : 'text-gray-500'
                        }`}
                        style={isSorted ? { backgroundColor: rankBg(row.rank) } : undefined}
                      >
                        <span className="text-xs">
                          {m === 'watch_time'
                            ? `${Math.round(row.value / 3600000)}h`
                            : row.value.toLocaleString()}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}
