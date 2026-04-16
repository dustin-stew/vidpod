import { NextResponse } from 'next/server'
import { listAssets, createAsset } from '@/lib/db/repositories/assets'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'video' | 'audio' | null
    const contentType = searchParams.get('contentType') as 'content' | 'ad' | null
    const folderParam = searchParams.get('folder')
    const folderFilter = folderParam === null
      ? undefined
      : folderParam === '__none__'
        ? null
        : folderParam
    const assets = listAssets({
      type: type ?? undefined,
      contentType: contentType ?? undefined,
      ...(folderFilter !== undefined ? { folder: folderFilter } : {}),
    })
    return NextResponse.json(assets)
  } catch (err) {
    console.error('[GET /api/assets]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, filePath, type, contentType, duration, folder } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!filePath || typeof filePath !== 'string') {
      return NextResponse.json({ error: 'filePath is required' }, { status: 400 })
    }
    if (type !== 'video' && type !== 'audio') {
      return NextResponse.json({ error: 'type must be video or audio' }, { status: 400 })
    }
    if (contentType && contentType !== 'content' && contentType !== 'ad') {
      return NextResponse.json({ error: 'contentType must be content or ad' }, { status: 400 })
    }

    const normalizedFolder = typeof folder === 'string' && folder.trim() ? folder.trim() : null
    const asset = createAsset({ name, filePath, type, contentType, duration, folder: normalizedFolder })
    return NextResponse.json(asset, { status: 201 })
  } catch (err) {
    console.error('[POST /api/assets]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
