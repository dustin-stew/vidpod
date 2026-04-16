import { NextResponse } from 'next/server'
import { listAdFolders, renameAdFolder, clearAdFolder } from '@/lib/db/repositories/assets'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return NextResponse.json(listAdFolders())
  } catch (err) {
    console.error('[GET /api/assets/folders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { oldName, newName } = await request.json()
    if (typeof oldName !== 'string' || !oldName.trim()) {
      return NextResponse.json({ error: 'oldName required' }, { status: 400 })
    }
    if (typeof newName !== 'string' || !newName.trim()) {
      return NextResponse.json({ error: 'newName required' }, { status: 400 })
    }
    const changed = renameAdFolder(oldName.trim(), newName.trim())
    return NextResponse.json({ changed })
  } catch (err) {
    console.error('[PATCH /api/assets/folders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const folder = searchParams.get('name')
    if (!folder) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const changed = clearAdFolder(folder)
    return NextResponse.json({ changed })
  } catch (err) {
    console.error('[DELETE /api/assets/folders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
