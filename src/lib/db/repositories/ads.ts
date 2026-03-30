import { db } from '../client'
import type { Ad } from '@/types'
import { nanoid } from '@/lib/nanoid'

interface AdRow {
  id: string
  name: string
  folder: string | null
  file_path: string
  duration: number
  thumbnail_path: string | null
  created_at: string
}

function rowToAd(row: AdRow): Ad {
  return {
    id: row.id,
    name: row.name,
    folder: row.folder,
    filePath: row.file_path,
    duration: row.duration,
    thumbnailPath: row.thumbnail_path,
    createdAt: row.created_at,
  }
}

export function listAds(folder?: string): Ad[] {
  if (folder) {
    const rows = db.prepare('SELECT * FROM ads WHERE folder = ? ORDER BY name ASC').all(folder) as AdRow[]
    return rows.map(rowToAd)
  }
  const rows = db.prepare('SELECT * FROM ads ORDER BY folder ASC, name ASC').all() as AdRow[]
  return rows.map(rowToAd)
}

export function getAd(id: string): Ad | null {
  const row = db.prepare('SELECT * FROM ads WHERE id = ?').get(id) as AdRow | null
  return row ? rowToAd(row) : null
}

export function createAd(data: {
  name: string
  filePath: string
  folder?: string | null
  duration?: number
  thumbnailPath?: string | null
}): Ad {
  const now = new Date().toISOString()
  const id = nanoid()
  db.prepare(
    `INSERT INTO ads (id, name, folder, file_path, duration, thumbnail_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.name, data.folder ?? null, data.filePath, data.duration ?? 0, data.thumbnailPath ?? null, now)
  return getAd(id)!
}

export function updateAd(
  id: string,
  data: Partial<{ name: string; folder: string | null; duration: number; thumbnailPath: string | null }>
): Ad | null {
  const existing = getAd(id)
  if (!existing) return null
  db.prepare(
    `UPDATE ads SET name = ?, folder = ?, duration = ?, thumbnail_path = ?, created_at = ? WHERE id = ?`
  ).run(
    data.name ?? existing.name,
    'folder' in data ? data.folder : existing.folder,
    data.duration ?? existing.duration,
    'thumbnailPath' in data ? data.thumbnailPath : existing.thumbnailPath,
    existing.createdAt,
    id
  )
  return getAd(id)!
}

export function deleteAd(id: string): boolean {
  const result = db.prepare('DELETE FROM ads WHERE id = ?').run(id)
  return (result as { changes: number }).changes > 0
}

export function listFolders(): string[] {
  const rows = db.prepare('SELECT DISTINCT folder FROM ads WHERE folder IS NOT NULL ORDER BY folder ASC').all() as { folder: string }[]
  return rows.map(r => r.folder)
}
