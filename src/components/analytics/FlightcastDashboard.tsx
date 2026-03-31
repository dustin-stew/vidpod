'use client'

import { EpisodeOverlapChart } from './charts/EpisodeOverlapChart'
import { RetentionFunnelChart } from './charts/RetentionFunnelChart'
import { NewVsReturningChart } from './charts/NewVsReturningChart'
import { RelativePerformanceChart } from './charts/RelativePerformanceChart'
import { DailyPerformanceChart } from './charts/DailyPerformanceChart'
import { AudienceSourceChart } from './charts/AudienceSourceChart'
import { GeoBreakdownChart } from './charts/GeoBreakdownChart'
import { DeviceBreakdownChart } from './charts/DeviceBreakdownChart'
import { AdDeliveryFunnelChart } from './charts/AdDeliveryFunnelChart'
import { TopVideosTable } from './charts/TopVideosTable'

export function FlightcastDashboard() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Flightcast Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Performance insights across episodes, audience, and ads</p>
      </div>

      {/* Row 1: Performance overview */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <DailyPerformanceChart />
        <NewVsReturningChart />
      </div>

      {/* Row 2: Relative performance (full width) */}
      <RelativePerformanceChart />

      {/* Row 3: Audience breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <AudienceSourceChart />
        <GeoBreakdownChart />
      </div>

      {/* Row 4: Device + Ad funnel */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <DeviceBreakdownChart />
        <AdDeliveryFunnelChart />
      </div>

      {/* Row 5: Retention + Overlap */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <RetentionFunnelChart />
        <EpisodeOverlapChart />
      </div>

      {/* Row 6: Top videos (full width) */}
      <TopVideosTable />
    </div>
  )
}
