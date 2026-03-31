'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import type { RetentionFunnelRow } from '@/types/analytics'
import { ChartCard, LoadingState, ErrorState } from './shared'

const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff']

export function RetentionFunnelChart() {
  const { data, loading, error } = useAnalyticsData<RetentionFunnelRow>('retention-funnel')

  if (loading) return <ChartCard title="Listener Retention Funnel"><LoadingState /></ChartCard>
  if (error || !data) return <ChartCard title="Listener Retention Funnel"><ErrorState error={error} /></ChartCard>

  return (
    <ChartCard title="Listener Retention Funnel" subtitle="All-time episodes watched per user">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
          <XAxis type="number" tickFormatter={(v) => `${v.toLocaleString()}`} />
          <YAxis type="category" dataKey="episodes_watched_bucket" width={40} />
          <Tooltip
            formatter={(value, _name, props) => [
              `${Number(value).toLocaleString()} users (${(props?.payload as RetentionFunnelRow)?.percent_of_total_users ?? 0}%)`,
              'Users'
            ]}
          />
          <Bar dataKey="users" radius={[0, 4, 4, 0]}>
            {data.map((_entry, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
