import { NextResponse } from 'next/server'
import { fetchRollup } from '@/lib/s3Client'
import type { EpisodeOverlapRow } from '@/types/analytics'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const data = await fetchRollup<EpisodeOverlapRow>('episode_overlap')
    return NextResponse.json(data)
  } catch (err) {
    console.error('[GET /api/analytics/episode-overlap]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
