import { db } from '../client'
import type { EpisodeClip } from '@/types'
import { nanoid } from '@/lib/nanoid'
import { getAsset } from './assets'

interface ClipRow {
  id: string
  episode_id: string
  asset_id: string
  clip_type: 'content' | 'ad'
  order_index: number
  start_offset: number
  end_offset: number
  created_at: string
  ab_test_group_id: string | null
  ab_test_variant_ids: string | null
  ab_test_group_name: string | null
}

function rowToClip(row: ClipRow): EpisodeClip | null {
  const asset = getAsset(row.asset_id)
  if (!asset) return null
  return {
    id: row.id,
    episodeId: row.episode_id,
    assetId: row.asset_id,
    clipType: row.clip_type,
    orderIndex: row.order_index,
    startOffset: row.start_offset ?? 0,
    endOffset: row.end_offset ?? -1,
    createdAt: row.created_at,
    asset,
    abTestGroupId: row.ab_test_group_id ?? null,
    abTestVariantIds: row.ab_test_variant_ids ?? null,
    abTestGroupName: row.ab_test_group_name ?? null,
  }
}

export function listClips(episodeId: string): EpisodeClip[] {
  const rows = db
    .prepare('SELECT * FROM episode_clips WHERE episode_id = ? ORDER BY order_index ASC')
    .all(episodeId) as ClipRow[]
  return rows.map(rowToClip).filter(Boolean) as EpisodeClip[]
}

export function addClip(data: {
  episodeId: string
  assetId: string
  clipType: 'content' | 'ad'
  orderIndex: number
  startOffset?: number
  endOffset?: number
}): EpisodeClip {
  const id = nanoid()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO episode_clips (id, episode_id, asset_id, clip_type, order_index, start_offset, end_offset, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.episodeId, data.assetId, data.clipType, data.orderIndex,
    data.startOffset ?? 0, data.endOffset ?? -1, now)
  db.prepare(
    `UPDATE episode_clips SET order_index = order_index + 1 WHERE episode_id = ? AND order_index >= ? AND id != ?`
  ).run(data.episodeId, data.orderIndex, id)
  return rowToClip(db.prepare('SELECT * FROM episode_clips WHERE id = ?').get(id) as ClipRow)!
}

export function splitClip(clipId: string, splitOffset: number, adAssetId: string): {
  clip1: EpisodeClip; adClip: EpisodeClip; clip2: EpisodeClip
} {
  const original = db.prepare('SELECT * FROM episode_clips WHERE id = ?').get(clipId) as ClipRow
  if (!original) throw new Error('Clip not found')

  const now = new Date().toISOString()
  const adId = nanoid()
  const clip2Id = nanoid()

  db.prepare(
    `UPDATE episode_clips SET order_index = order_index + 2 WHERE episode_id = ? AND order_index > ?`
  ).run(original.episode_id, original.order_index)

  db.prepare(`UPDATE episode_clips SET end_offset = ? WHERE id = ?`).run(splitOffset, clipId)

  db.prepare(
    `INSERT INTO episode_clips (id, episode_id, asset_id, clip_type, order_index, start_offset, end_offset, created_at)
     VALUES (?, ?, ?, 'ad', ?, 0, -1, ?)`
  ).run(adId, original.episode_id, adAssetId, original.order_index + 1, now)

  db.prepare(
    `INSERT INTO episode_clips (id, episode_id, asset_id, clip_type, order_index, start_offset, end_offset, created_at)
     VALUES (?, ?, ?, 'content', ?, ?, ?, ?)`
  ).run(clip2Id, original.episode_id, original.asset_id, original.order_index + 2,
    splitOffset, original.end_offset, now)

  const getRow = (id: string) => db.prepare('SELECT * FROM episode_clips WHERE id = ?').get(id) as ClipRow
  return {
    clip1: rowToClip(getRow(clipId))!,
    adClip: rowToClip(getRow(adId))!,
    clip2: rowToClip(getRow(clip2Id))!,
  }
}

export function removeClip(id: string): void {
  const clip = db.prepare('SELECT * FROM episode_clips WHERE id = ?').get(id) as ClipRow | null
  if (!clip) return
  db.prepare('DELETE FROM episode_clips WHERE id = ?').run(id)
  db.prepare(
    `UPDATE episode_clips SET order_index = order_index - 1 WHERE episode_id = ? AND order_index > ?`
  ).run(clip.episode_id, clip.order_index)
}

export function reorderClips(episodeId: string, orderedIds: string[]): void {
  const stmt = db.prepare('UPDATE episode_clips SET order_index = ? WHERE id = ? AND episode_id = ?')
  orderedIds.forEach((id, index) => stmt.run(index, id, episodeId))
}

export function updateClipAbTest(clipId: string, data: {
  abTestGroupId: string | null
  abTestVariantIds: string | null
  abTestGroupName: string | null
}): void {
  db.prepare(
    'UPDATE episode_clips SET ab_test_group_id = ?, ab_test_variant_ids = ?, ab_test_group_name = ? WHERE id = ?'
  ).run(data.abTestGroupId, data.abTestVariantIds, data.abTestGroupName, clipId)
}
