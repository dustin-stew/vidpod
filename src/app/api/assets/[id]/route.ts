import { NextResponse } from 'next/server'
import { updateAssetDuration, updateAssetFolder } from '@/lib/db/repositories/assets'

export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    if (typeof body.duration === 'number' && body.duration > 0) {
      updateAssetDuration(id, body.duration)
    }
    if ('folder' in body) {
      const folder = body.folder
      if (folder === null || folder === '') {
        updateAssetFolder(id, null)
      } else if (typeof folder === 'string' && folder.trim()) {
        updateAssetFolder(id, folder.trim())
      }
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PATCH /api/assets/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
