import { NextResponse } from 'next/server'
import { getAd, updateAd, deleteAd } from '@/lib/db/repositories/ads'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const ad = getAd(id)
    if (!ad) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(ad)
  } catch (err) {
    console.error('[GET /api/ads/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const updated = updateAd(id, body)
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[PATCH /api/ads/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const deleted = deleteAd(id)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[DELETE /api/ads/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
