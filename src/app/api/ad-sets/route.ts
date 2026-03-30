import { NextResponse } from 'next/server'
import { listAdSets, createAdSet } from '@/lib/db/repositories/adSets'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return NextResponse.json(listAdSets())
  } catch (err) {
    console.error('[GET /api/ad-sets]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, assetIds } = body
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json({ error: 'assetIds must be a non-empty array' }, { status: 400 })
    }
    const adSet = createAdSet({ name, assetIds })
    return NextResponse.json(adSet, { status: 201 })
  } catch (err) {
    console.error('[POST /api/ad-sets]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
