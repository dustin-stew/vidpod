import { NextResponse } from 'next/server'
import { fetchRollup } from '@/lib/s3Client'
import type { RelativePerformanceRow } from '@/types/analytics'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const data = await fetchRollup<RelativePerformanceRow>('relative_performance')
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/analytics/relative-performance]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
