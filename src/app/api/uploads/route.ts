import { NextResponse } from 'next/server'
import { handleUpload, UploadError } from '@/lib/uploadHandler'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get('file')
    const uploadType = form.get('type') as 'episode' | 'ad' | null

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (uploadType !== 'episode' && uploadType !== 'ad') {
      return NextResponse.json({ error: 'type must be "episode" or "ad"' }, { status: 400 })
    }

    const result = await handleUpload(file, uploadType)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    console.error('[POST /api/uploads]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
