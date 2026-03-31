import { NextResponse } from 'next/server'
import { fetchRollup } from '@/lib/s3Client'
import type { DailyPerformanceRow } from '@/types/analytics'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const data = await fetchRollup<DailyPerformanceRow>('daily_performance')
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/analytics/daily-performance]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
