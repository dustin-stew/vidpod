import { db } from '../client'
import type { Episode, EpisodeWithMarkers } from '@/types'
import { nanoid } from '@/lib/nanoid'
import { hydrateMarkers } from './markers'

interface EpisodeRow {
  id: string
  title: string
  video_path: string
  duration: number
  thumbnail_path: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

function rowToEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    title: row.title,
    videoPath: row.video_path,
    duration: row.duration,
    thumbnailPath: row.thumbnail_path,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listEpisodes(): Episode[] {
  const rows = db.prepare('SELECT * FROM episodes ORDER BY created_at DESC').all() as EpisodeRow[]
  return rows.map(rowToEpisode)
}

export function getEpisode(id: string): Episode | null {
  const row = db.prepare('SELECT * FROM episodes WHERE id = ?').get(id) as EpisodeRow | null
  return row ? rowToEpisode(row) : null
}

export function getEpisodeWithMarkers(id: string): EpisodeWithMarkers | null {
  const episode = getEpisode(id)
  if (!episode) return null
  return { ...episode, markers: hydrateMarkers(id) }
}

export function createEpisode(data: {
  title: string
  videoPath: string
  duration?: number
  thumbnailPath?: string | null
  publishedAt?: string | null
}): Episode {
  const now = new Date().toISOString()
  const id = nanoid()
  db.prepare(
    `INSERT INTO episodes (id, title, video_path, duration, thumbnail_path, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.title, data.videoPath, data.duration ?? 0, data.thumbnailPath ?? null, data.publishedAt ?? null, now, now)
  return getEpisode(id)!
}

export function updateEpisode(
  id: string,
  data: Partial<{ title: string; videoPath: string; duration: number; thumbnailPath: string | null; publishedAt: string | null }>
): Episode | null {
  const existing = getEpisode(id)
  if (!existing) return null
  const now = new Date().toISOString()
  const updated = {
    title: data.title ?? existing.title,
    video_path: data.videoPath ?? existing.videoPath,
    duration: data.duration ?? existing.duration,
    thumbnail_path: 'thumbnailPath' in data ? data.thumbnailPath : existing.thumbnailPath,
    published_at: 'publishedAt' in data ? data.publishedAt : existing.publishedAt,
  }
  db.prepare(
    `UPDATE episodes SET title = ?, video_path = ?, duration = ?, thumbnail_path = ?, published_at = ?, updated_at = ? WHERE id = ?`
  ).run(updated.title, updated.video_path, updated.duration, updated.thumbnail_path, updated.published_at, now, id)
  return getEpisode(id)!
}

export function deleteEpisode(id: string): boolean {
  const result = db.prepare('DELETE FROM episodes WHERE id = ?').run(id)
  return (result as { changes: number }).changes > 0
}
