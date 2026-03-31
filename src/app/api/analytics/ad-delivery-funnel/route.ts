import { NextResponse } from 'next/server'
import { fetchRollup } from '@/lib/s3Client'
import type { AdDeliveryFunnelRow } from '@/types/analytics'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const data = await fetchRollup<AdDeliveryFunnelRow>('ad_delivery_funnel')
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/analytics/ad-delivery-funnel]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
