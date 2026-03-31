'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import type { NewVsReturningRow } from '@/types/analytics'
import { ChartCard, LoadingState, ErrorState } from './shared'

export function NewVsReturningChart() {
  const { data, loading, error } = useAnalyticsData<NewVsReturningRow>('new-vs-returning')

  if (loading) return <ChartCard title="New vs Returning"><LoadingState /></ChartCard>
  if (error || !data) return <ChartCard title="New vs Returning"><ErrorState error={error} /></ChartCard>

  // Sample to last 90 days if too many points
  const display = data.length > 90 ? data.slice(-90) : data

  return (
    <ChartCard title="New vs Returning Audience" subtitle="Daily unique users (last 90 days)">
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
          <Area
            type="monotone"
            dataKey="returning_users"
            stackId="1"
            stroke="#6366f1"
            fill="#c7d2fe"
            name="Returning"
          />
          <Area
            type="monotone"
            dataKey="new_users"
            stackId="1"
            stroke="#10b981"
            fill="#a7f3d0"
            name="New"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
