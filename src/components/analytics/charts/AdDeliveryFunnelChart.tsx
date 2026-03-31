'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import type { AdDeliveryFunnelRow } from '@/types/analytics'
import { ChartCard, LoadingState, ErrorState } from './shared'

export function AdDeliveryFunnelChart() {
  const { data, loading, error } = useAnalyticsData<AdDeliveryFunnelRow>('ad-delivery-funnel')

  if (loading) return <ChartCard title="Ad Delivery Funnel"><LoadingState /></ChartCard>
  if (error || !data) return <ChartCard title="Ad Delivery Funnel"><ErrorState error={error} /></ChartCard>

  const display = data.length > 90 ? data.slice(-90) : data

  return (
    <ChartCard title="Ad Delivery Funnel" subtitle="Opportunities, impressions & completions (last 90 days)">
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
            formatter={(v, name) => {
              if (name === 'Fill Rate') return `${v}%`
              return Number(v).toLocaleString()
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="opportunities" stroke="#94a3b8" strokeWidth={2} dot={false} name="Opportunities" />
          <Line type="monotone" dataKey="impressions" stroke="#6366f1" strokeWidth={2} dot={false} name="Impressions" />
          <Line type="monotone" dataKey="completions" stroke="#10b981" strokeWidth={2} dot={false} name="Completions" />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
