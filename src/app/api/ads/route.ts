import { NextResponse } from 'next/server'
import { listAds, listFolders, createAd } from '@/lib/db/repositories/ads'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('folder') ?? undefined
    const ads = listAds(folder)
    const folders = listFolders()
    return NextResponse.json({ ads, folders })
  } catch (err) {
    console.error('[GET /api/ads]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, filePath, folder, duration, thumbnailPath } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ error: 'filePath is required' }, { status: 400 })
    }

    const ad = createAd({ name, filePath, folder, duration, thumbnailPath })
    return NextResponse.json(ad, { status: 201 })
  } catch (err) {
    console.error('[POST /api/ads]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
