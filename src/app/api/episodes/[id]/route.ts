import { NextResponse } from 'next/server'
import { getEpisodeWithMarkers, updateEpisode, deleteEpisode } from '@/lib/db/repositories/episodes'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const episode = getEpisodeWithMarkers(id)
    if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(episode)
  } catch (err) {
    console.error('[GET /api/episodes/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const updated = updateEpisode(id, body)
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/episodes/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const deleted = deleteEpisode(id)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[DELETE /api/episodes/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
