import { NextResponse } from 'next/server'
import { listAbTestGroups, createAbTestGroup } from '@/lib/db/repositories/abTestGroups'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return NextResponse.json(listAbTestGroups())
  } catch (err) {
    console.error('[GET /api/ab-test-groups]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, adSetIds } = body
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!Array.isArray(adSetIds) || adSetIds.length === 0) {
      return NextResponse.json({ error: 'adSetIds must be a non-empty array' }, { status: 400 })
    }
    const group = createAbTestGroup({ name, adSetIds })
    return NextResponse.json(group, { status: 201 })
  } catch (err) {
    console.error('[POST /api/ab-test-groups]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
