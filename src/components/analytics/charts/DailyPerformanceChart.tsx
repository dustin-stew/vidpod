'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import type { DailyPerformanceRow } from '@/types/analytics'
import { ChartCard, LoadingState, ErrorState } from './shared'

export function DailyPerformanceChart() {
  const { data, loading, error } = useAnalyticsData<DailyPerformanceRow>('daily-performance')

  if (loading) return <ChartCard title="Daily Performance"><LoadingState /></ChartCard>
  if (error || !data) return <ChartCard title="Daily Performance"><ErrorState error={error} /></ChartCard>

  const display = data.length > 90 ? data.slice(-90) : data

  return (
    <ChartCard title="Daily Performance Trend" subtitle="Last 90 days">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={display} margin={{ left: 0, right: 10 }}>
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
          <Line type="monotone" dataKey="views" stroke="#6366f1" strokeWidth={2} dot={false} name="Views" />
          <Line type="monotone" dataKey="listens" stroke="#10b981" strokeWidth={2} dot={false} name="Listens" />
          <Line type="monotone" dataKey="streams" stroke="#f59e0b" strokeWidth={2} dot={false} name="Streams" />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
