'use client'

import { useAnalyticsData } from '../hooks/useAnalyticsData'
import type { EpisodeOverlapRow } from '@/types/analytics'
import { ChartCard, LoadingState, ErrorState } from './shared'

export function EpisodeOverlapChart() {
  const { data, loading, error } = useAnalyticsData<EpisodeOverlapRow>('episode-overlap')

  if (loading) return <ChartCard title="Episode Overlap"><LoadingState /></ChartCard>
  if (error || !data) return <ChartCard title="Episode Overlap"><ErrorState error={error} /></ChartCard>

  // Show top 20 pairs by shared users
  const top = data.slice(0, 20)

  return (
    <ChartCard title="Episode Overlap" subtitle="Top 20 episode pairs by shared audience">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-2 pr-3 font-medium">Episode A</th>
              <th className="pb-2 pr-3 font-medium">Episode B</th>
              <th className="pb-2 pr-3 font-medium text-right">Shared</th>
              <th className="pb-2 pr-3 font-medium text-right">Users in A</th>
              <th className="pb-2 font-medium text-right">Overlap %</th>
            </tr>
          </thead>
          <tbody>
            {top.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="py-2 pr-3 font-mono text-xs">{row.episode_a}</td>
                <td className="py-2 pr-3 font-mono text-xs">{row.episode_b}</td>
                <td className="py-2 pr-3 text-right">{row.shared_users.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right">{row.users_in_a.toLocaleString()}</td>
                <td className="py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${Math.min(row.overlap_percent, 100)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right">{row.overlap_percent}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}
