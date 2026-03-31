'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useAnalyticsData } from '../hooks/useAnalyticsData'
import type { DeviceBreakdownRow } from '@/types/analytics'
import { ChartCard, LoadingState, ErrorState } from './shared'

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#ef4444',
  spotify: '#10b981',
  apple: '#6366f1',
  rss: '#f59e0b',
}

export function DeviceBreakdownChart() {
  const { data, loading, error } = useAnalyticsData<DeviceBreakdownRow>('device-breakdown')

  if (loading) return <ChartCard title="Devices & Platforms"><LoadingState /></ChartCard>
  if (error || !data) return <ChartCard title="Devices & Platforms"><ErrorState error={error} /></ChartCard>

  // Pivot by device_type, stack by platform
  const devices = Array.from(new Set(data.map((r) => r.device_type)))
  const platforms = Array.from(new Set(data.map((r) => r.platform)))
  const pivoted = devices.map((dev) => {
    const row: Record<string, string | number> = { device_type: dev }
    for (const plat of platforms) {
      const match = data.find((r) => r.device_type === dev && r.platform === plat)
      row[plat] = match?.views ?? 0
    }
    return row
  })

  return (
    <ChartCard title="Device & Platform Breakdown" subtitle="Views by device and platform">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={pivoted} margin={{ left: 0, right: 10 }}>
          <XAxis dataKey="device_type" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => Number(v).toLocaleString()} />
          <Legend />
          {platforms.map((plat) => (
            <Bar
              key={plat}
              dataKey={plat}
              stackId="1"
              fill={PLATFORM_COLORS[plat] || '#94a3b8'}
              name={plat.charAt(0).toUpperCase() + plat.slice(1)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
