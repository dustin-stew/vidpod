'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import type { GeoBreakdownRow } from '@/types/analytics'
import { ChartCard, LoadingState, ErrorState } from './shared'

export function GeoBreakdownChart() {
  const { data, loading, error } = useAnalyticsData<GeoBreakdownRow>('geo-breakdown')

  if (loading) return <ChartCard title="Geography"><LoadingState /></ChartCard>
  if (error || !data) return <ChartCard title="Geography"><ErrorState error={error} /></ChartCard>

  const top15 = data.slice(0, 15)

  return (
    <ChartCard title="Geography Breakdown" subtitle="Top 15 countries by views">
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={top15} layout="vertical" margin={{ left: 10, right: 30 }}>
          <XAxis type="number" tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="country" width={35} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value, name) => [
              Number(value).toLocaleString(),
              name === 'views' ? 'Views' : name === 'unique_users' ? 'Unique Users' : String(name),
            ]}
          />
          <Bar dataKey="views" fill="#6366f1" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
