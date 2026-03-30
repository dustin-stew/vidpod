import { NextResponse } from 'next/server'
import { listClips, addClip } from '@/lib/db/repositories/clips'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const episodeId = searchParams.get('episodeId')
    if (!episodeId) return NextResponse.json({ error: 'episodeId is required' }, { status: 400 })
    return NextResponse.json(listClips(episodeId))
  } catch (err) {
    console.error('[GET /api/clips]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { episodeId, assetId, clipType, orderIndex } = body

    if (!episodeId || !assetId) {
      return NextResponse.json({ error: 'episodeId and assetId are required' }, { status: 400 })
    }
    if (clipType !== 'content' && clipType !== 'ad') {
      return NextResponse.json({ error: 'clipType must be content or ad' }, { status: 400 })
    }

    const clip = addClip({
      episodeId,
      assetId,
      clipType,
      orderIndex: typeof orderIndex === 'number' ? orderIndex : 9999,
    })
    return NextResponse.json(clip, { status: 201 })
  } catch (err) {
    console.error('[POST /api/clips]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
