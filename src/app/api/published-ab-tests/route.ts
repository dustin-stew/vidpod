import { NextResponse } from 'next/server'
import { listPublishedAbTests, publishAbTest } from '@/lib/db/repositories/publishedAbTests'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return NextResponse.json(listPublishedAbTests())
  } catch (err) {
    console.error('[GET /api/published-ab-tests]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { episodeId, abTestGroupId, abTestGroupName, episodeTitle, clipTimestamp, variantNames } = body
    if (!episodeId || !abTestGroupId || !abTestGroupName || !episodeTitle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const result = publishAbTest({ episodeId, abTestGroupId, abTestGroupName, episodeTitle, clipTimestamp: clipTimestamp ?? 0, variantNames })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('[POST /api/published-ab-tests]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
