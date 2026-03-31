import { NextResponse } from 'next/server'
import { fetchRollup } from '@/lib/s3Client'
import type { TopVideoRow } from '@/types/analytics'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const data = await fetchRollup<TopVideoRow>('top_videos')
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/analytics/top-videos]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
