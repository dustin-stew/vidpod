'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import type { AudienceSourceRow } from '@/types/analytics'
import { ChartCard, LoadingState, ErrorState } from './shared'

const SOURCE_COLORS: Record<string, string> = {
  search: '#6366f1',
  browse: '#10b981',
  direct: '#f59e0b',
  notification: '#ef4444',
  external: '#8b5cf6',
  playlist: '#06b6d4',
}

export function AudienceSourceChart() {
  const { data, loading, error } = useAnalyticsData<AudienceSourceRow>('audience-source')

  if (loading) return <ChartCard title="Audience Sources"><LoadingState /></ChartCard>
  if (error || !data) return <ChartCard title="Audience Sources"><ErrorState error={error} /></ChartCard>

  // Pivot: group by day, each source becomes a key
  const sources = Array.from(new Set(data.map((r) => r.source)))
  const byDay = new Map<string, Record<string, string | number>>()
  for (const row of data) {
    const existing = byDay.get(row.day) || { day: row.day }
    existing[row.source] = row.views
    byDay.set(row.day, existing)
  }
  const pivoted = Array.from(byDay.values())
  const display = pivoted.length > 90 ? pivoted.slice(-90) : pivoted

  return (
    <ChartCard title="Audience Source Breakdown" subtitle="Views by traffic source (last 90 days)">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={display} margin={{ left: 0, right: 10 }}>
          <XAxis
            dataKey="day"
            tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            interval={13}
            tick={{ fontSize: 11 }}
          />
          <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 11 }} />
          <Tooltip
            labelFormatter={(d) => new Date(d as string).toLocaleDateString()}
            formatter={(v) => Number(v).toLocaleString()}
          />
          <Legend />
          {sources.map((src) => (
            <Area
              key={src}
              type="monotone"
              dataKey={src}
              stackId="1"
              stroke={SOURCE_COLORS[src] || '#94a3b8'}
              fill={SOURCE_COLORS[src] || '#94a3b8'}
              fillOpacity={0.6}
              name={src.charAt(0).toUpperCase() + src.slice(1)}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
