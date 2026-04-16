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
  folder: string | null
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
    folder: row.folder ?? null,
    createdAt: row.created_at,
  }
}

export function listAssets(filters?: { type?: 'video' | 'audio'; contentType?: 'content' | 'ad'; folder?: string | null }): Asset[] {
  const conditions: string[] = []
  const params: (string | null)[] = []
  if (filters?.type) { conditions.push('type = ?'); params.push(filters.type) }
  if (filters?.contentType) { conditions.push('content_type = ?'); params.push(filters.contentType) }
  if (filters && 'folder' in filters) {
    if (filters.folder === null) conditions.push('folder IS NULL')
    else if (filters.folder) { conditions.push('folder = ?'); params.push(filters.folder) }
  }
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
  folder?: string | null
}): Asset {
  const now = new Date().toISOString()
  const id = nanoid()
  db.prepare(
    `INSERT INTO assets (id, name, file_path, type, content_type, duration, folder, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.name, data.filePath, data.type, data.contentType ?? 'content', data.duration ?? 0, data.folder ?? null, now)
  return getAsset(id)!
}

export function updateAssetDuration(id: string, duration: number): void {
  db.prepare('UPDATE assets SET duration = ? WHERE id = ?').run(duration, id)
}

export function updateAssetFolder(id: string, folder: string | null): void {
  db.prepare('UPDATE assets SET folder = ? WHERE id = ?').run(folder, id)
}

export function listAdFolders(): string[] {
  const rows = db.prepare(
    `SELECT DISTINCT folder FROM assets WHERE content_type = 'ad' AND folder IS NOT NULL AND folder <> '' ORDER BY folder COLLATE NOCASE ASC`
  ).all() as { folder: string }[]
  return rows.map(r => r.folder)
}

export function renameAdFolder(oldName: string, newName: string): number {
  const res = db.prepare(
    `UPDATE assets SET folder = ? WHERE content_type = 'ad' AND folder = ?`
  ).run(newName, oldName)
  return Number(res.changes ?? 0)
}

export function clearAdFolder(folder: string): number {
  const res = db.prepare(
    `UPDATE assets SET folder = NULL WHERE content_type = 'ad' AND folder = ?`
  ).run(folder)
  return Number(res.changes ?? 0)
}
