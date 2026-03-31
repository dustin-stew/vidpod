import { NextResponse } from 'next/server'
import { fetchRollup } from '@/lib/s3Client'
import type { AudienceSourceRow } from '@/types/analytics'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const data = await fetchRollup<AudienceSourceRow>('audience_source')
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/analytics/audience-source]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
