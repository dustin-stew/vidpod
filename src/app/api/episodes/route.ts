import { NextResponse } from 'next/server'
import { listEpisodes, createEpisode } from '@/lib/db/repositories/episodes'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const episodes = listEpisodes()
    return NextResponse.json(episodes)
  } catch (err) {
    console.error('[GET /api/episodes]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, videoPath, duration, thumbnailPath, publishedAt } = body

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    const episode = createEpisode({ title, videoPath: videoPath ?? '', duration, thumbnailPath, publishedAt })
    return NextResponse.json(episode, { status: 201 })
  } catch (err) {
    console.error('[POST /api/episodes]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
