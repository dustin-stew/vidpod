'use client'

import { useAnalyticsData } from '../hooks/useAnalyticsData'
import type { TopVideoRow } from '@/types/analytics'
import { ChartCard, LoadingState, ErrorState } from './shared'

function formatWatchTime(ms: number): string {
  const hours = Math.floor(ms / 3600000)
  if (hours >= 1000) return `${(hours / 1000).toFixed(1)}k hrs`
  return `${hours.toLocaleString()} hrs`
}

export function TopVideosTable() {
  const { data, loading, error } = useAnalyticsData<TopVideoRow>('top-videos')

  if (loading) return <ChartCard title="Top Videos"><LoadingState /></ChartCard>
  if (error || !data) return <ChartCard title="Top Videos"><ErrorState error={error} /></ChartCard>

  const top25 = data.slice(0, 25)

  return (
    <ChartCard title="Top Videos" subtitle="Ranked by total consumption (views + listens + streams)">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-2 pr-2 font-medium w-12">#</th>
              <th className="pb-2 pr-3 font-medium">Video</th>
              <th className="pb-2 pr-3 font-medium text-right">Views</th>
              <th className="pb-2 pr-3 font-medium text-right">Listens</th>
              <th className="pb-2 font-medium text-right">Watch Time</th>
            </tr>
          </thead>
          <tbody>
            {top25.map((row) => (
              <tr key={row.video_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="py-2 pr-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    row.rank <= 3
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {row.rank}
                  </span>
                </td>
                <td className="py-2 pr-3 font-mono text-xs">{row.video_id}</td>
                <td className="py-2 pr-3 text-right">{row.views.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right">{row.listens.toLocaleString()}</td>
                <td className="py-2 text-right">{formatWatchTime(row.watch_time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}
