import { db } from '../client'
import type { Asset } from '@/types'
import { nanoid } from '@/lib/nanoid'

interface AssetRow {
  id: string
  name: string
  file_path: string
  type: 'video' | 'audio'
  content_type: 'content' | 'ad'
  duration: number
  created_at: string
}

function rowToAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    name: row.name,
    filePath: row.file_path,
    type: row.type,
    contentType: row.content_type,
    duration: row.duration,
    createdAt: row.created_at,
  }
}

export function listAssets(filters?: { type?: 'video' | 'audio'; contentType?: 'content' | 'ad' }): Asset[] {
  const conditions: string[] = []
  const params: string[] = []
  if (filters?.type) { conditions.push('type = ?'); params.push(filters.type) }
  if (filters?.contentType) { conditions.push('content_type = ?'); params.push(filters.contentType) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.prepare(`SELECT * FROM assets ${where} ORDER BY created_at DESC`).all(...params) as AssetRow[]
  return rows.map(rowToAsset)
}

export function getAsset(id: string): Asset | null {
  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id) as AssetRow | null
  return row ? rowToAsset(row) : null
}

export function createAsset(data: {
  name: string
  filePath: string
  type: 'video' | 'audio'
  contentType?: 'content' | 'ad'
  duration?: number
}): Asset {
  const now = new Date().toISOString()
  const id = nanoid()
  db.prepare(
    `INSERT INTO assets (id, name, file_path, type, content_type, duration, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.name, data.filePath, data.type, data.contentType ?? 'content', data.duration ?? 0, now)
  return getAsset(id)!
}

export function updateAssetDuration(id: string, duration: number): void {
  db.prepare('UPDATE assets SET duration = ? WHERE id = ?').run(duration, id)
}
