import { NextResponse } from 'next/server'
import { getAbTestGroup, updateAbTestGroup, deleteAbTestGroup, addSetsToGroup } from '@/lib/db/repositories/abTestGroups'

export const runtime = 'nodejs'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const group = getAbTestGroup(id)
    if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(group)
  } catch (err) {
    console.error('[GET /api/ab-test-groups/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    if (body.addAdSetIds && Array.isArray(body.addAdSetIds)) {
      const group = addSetsToGroup(id, body.addAdSetIds)
      if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json(group)
    }
    const group = updateAbTestGroup(id, body)
    if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(group)
  } catch (err) {
    console.error('[PATCH /api/ab-test-groups/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    deleteAbTestGroup(id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[DELETE /api/ab-test-groups/:id]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
