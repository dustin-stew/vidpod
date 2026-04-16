import { NextResponse } from 'next/server'
import { mergeAdjacentSiblings } from '@/lib/db/repositories/clips'

export const runtime = 'nodejs'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const merges = mergeAdjacentSiblings(id)
    return NextResponse.json({ merges })
  } catch (err) {
    console.error('[POST /api/episodes/[id]/merge-siblings]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
