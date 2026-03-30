import { NextResponse } from 'next/server'
import { getMarker, updateMarker, deleteMarker } from '@/lib/db/repositories/markers'
import type { MarkerType } from '@/types'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

const VALID_TYPES = new Set<MarkerType>(['AUTO', 'STATIC', 'AB_TEST'])

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const marker = getMarker(id)
    if (!marker) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(marker)
  } catch (err) {
    console.error('[GET /api/markers/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const { timestamp, type, adIds, winnerId } = body

    if (timestamp !== undefined && (typeof timestamp !== 'number' || timestamp < 0)) {
      return NextResponse.json({ error: 'timestamp must be a non-negative number' }, { status: 400 })
    }
    if (type !== undefined && !VALID_TYPES.has(type)) {
      return NextResponse.json({ error: 'invalid type' }, { status: 400 })
    }

    const marker = updateMarker(id, { timestamp, type, adIds, winnerId })
    if (!marker) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(marker)
  } catch (err) {
    console.error('[PATCH /api/markers/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const deleted = deleteMarker(id)
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[DELETE /api/markers/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
