import { NextResponse } from 'next/server'
import { removeClip, reorderClips, splitClip, updateClipAbTest } from '@/lib/db/repositories/clips'

export const runtime = 'nodejs'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    removeClip(id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[DELETE /api/clips/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    if (body.action === 'setAbTest') {
      updateClipAbTest(id, {
        abTestGroupId: body.abTestGroupId ?? null,
        abTestVariantIds: body.abTestVariantIds ?? null,
        abTestGroupName: body.abTestGroupName ?? null,
      })
      return new NextResponse(null, { status: 204 })
    }

    if (body.action === 'split') {
      const { splitOffset, adAssetId } = body
      if (typeof splitOffset !== 'number' || !adAssetId) {
        return NextResponse.json({ error: 'splitOffset and adAssetId required' }, { status: 400 })
      }
      const result = splitClip(id, splitOffset, adAssetId)
      return NextResponse.json(result)
    }

    const { episodeId, orderedIds } = body
    if (!episodeId || !Array.isArray(orderedIds)) {
      return NextResponse.json({ error: 'episodeId and orderedIds required' }, { status: 400 })
    }
    reorderClips(episodeId, orderedIds)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[PATCH /api/clips/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
