import { NextResponse } from 'next/server'
import { fetchRollup } from '@/lib/s3Client'
import type { GeoBreakdownRow } from '@/types/analytics'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const data = await fetchRollup<GeoBreakdownRow>('geo_breakdown')
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/analytics/geo-breakdown]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
