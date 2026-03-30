import { NextResponse } from 'next/server'
import { createMarker } from '@/lib/db/repositories/markers'
import type { MarkerType } from '@/types'

export const runtime = 'nodejs'

const VALID_TYPES = new Set<MarkerType>(['AUTO', 'STATIC', 'AB_TEST'])

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { episodeId, timestamp, type, adIds } = body

    if (!episodeId || typeof episodeId !== 'string') {
      return NextResponse.json({ error: 'episodeId is required' }, { status: 400 })
    }
    if (typeof timestamp !== 'number' || timestamp < 0) {
      return NextResponse.json({ error: 'timestamp must be a non-negative number' }, { status: 400 })
    }
    if (!VALID_TYPES.has(type)) {
      return NextResponse.json({ error: 'type must be AUTO, STATIC, or AB_TEST' }, { status: 400 })
    }
    if (type === 'STATIC' && (!Array.isArray(adIds) || adIds.length !== 1)) {
      return NextResponse.json({ error: 'STATIC markers require exactly one adId' }, { status: 400 })
    }
    if (type === 'AB_TEST' && (!Array.isArray(adIds) || adIds.length < 2)) {
      return NextResponse.json({ error: 'AB_TEST markers require at least two adIds' }, { status: 400 })
    }

    const marker = createMarker({ episodeId, timestamp, type, adIds: adIds ?? [] })
    return NextResponse.json(marker, { status: 201 })
  } catch (err) {
    console.error('[POST /api/markers]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
