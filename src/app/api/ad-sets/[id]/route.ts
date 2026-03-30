import { NextResponse } from 'next/server'
import { getAdSet, updateAdSet, deleteAdSet, addAssetsToSet } from '@/lib/db/repositories/adSets'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const adSet = getAdSet(id)
    if (!adSet) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(adSet)
  } catch (err) {
    console.error('[GET /api/ad-sets/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    if (body.addAssetIds && Array.isArray(body.addAssetIds)) {
      const adSet = addAssetsToSet(id, body.addAssetIds)
      if (!adSet) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(adSet)
    }
    const adSet = updateAdSet(id, body)
    if (!adSet) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(adSet)
  } catch (err) {
    console.error('[PATCH /api/ad-sets/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    deleteAdSet(id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[DELETE /api/ad-sets/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
