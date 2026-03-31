import { NextResponse } from 'next/server'
import { fetchRollup } from '@/lib/s3Client'
import type { RetentionFunnelRow } from '@/types/analytics'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const data = await fetchRollup<RetentionFunnelRow>('listener_retention_funnel')
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/analytics/retention-funnel]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
