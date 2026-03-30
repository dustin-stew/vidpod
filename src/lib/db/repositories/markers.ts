import { db } from '../client'
import type { AdMarker, AdMarkerAd, MarkerType } from '@/types'
import { nanoid } from '@/lib/nanoid'
import { getAd } from './ads'

interface MarkerRow {
  id: string
  episode_id: string
  timestamp: number
  type: MarkerType
  winner_id: string | null
  created_at: string
  updated_at: string
}

interface MarkerAdRow {
  id: string
  marker_id: string
  ad_id: string
  position: number
}

function hydrateSingleMarker(row: MarkerRow): AdMarker {
  const adRows = db
    .prepare('SELECT * FROM marker_ads WHERE marker_id = ? ORDER BY position ASC')
    .all(row.id) as MarkerAdRow[]

  const ads: AdMarkerAd[] = adRows
    .map(r => {
      const ad = getAd(r.ad_id)
      if (!ad) return null
      return { id: r.id, markerId: r.marker_id, adId: r.ad_id, position: r.position, ad }
    })
    .filter((a): a is AdMarkerAd => a !== null)

  return {
    id: row.id,
    episodeId: row.episode_id,
    timestamp: row.timestamp,
    type: row.type,
    winnerId: row.winner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ads,
  }
}

export function hydrateMarkers(episodeId: string): AdMarker[] {
  const rows = db
    .prepare('SELECT * FROM ad_markers WHERE episode_id = ? ORDER BY timestamp ASC')
    .all(episodeId) as MarkerRow[]
  return rows.map(hydrateSingleMarker)
}

export function getMarker(id: string): AdMarker | null {
  const row = db.prepare('SELECT * FROM ad_markers WHERE id = ?').get(id) as MarkerRow | null
  return row ? hydrateSingleMarker(row) : null
}

export function createMarker(data: {
  episodeId: string
  timestamp: number
  type: MarkerType
  adIds?: string[]
}): AdMarker {
  const now = new Date().toISOString()
  const id = nanoid()

  const insert = db.prepare(
    `INSERT INTO ad_markers (id, episode_id, timestamp, type, winner_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?)`
  )
  const insertAd = db.prepare(
    `INSERT INTO marker_ads (id, marker_id, ad_id, position) VALUES (?, ?, ?, ?)`
  )

  const run = db.transaction(() => {
    insert.run(id, data.episodeId, data.timestamp, data.type, now, now)
    if (data.adIds) {
      data.adIds.forEach((adId, idx) => {
        insertAd.run(nanoid(), id, adId, idx)
      })
    }
  })
  run()

  return getMarker(id)!
}

export function updateMarker(
  id: string,
  data: Partial<{ timestamp: number; type: MarkerType; adIds: string[]; winnerId: string | null }>
): AdMarker | null {
  const existing = getMarker(id)
  if (!existing) return null
  const now = new Date().toISOString()

  const update = db.prepare(
    `UPDATE ad_markers SET timestamp = ?, type = ?, winner_id = ?, updated_at = ? WHERE id = ?`
  )
  const deleteAds = db.prepare('DELETE FROM marker_ads WHERE marker_id = ?')
  const insertAd = db.prepare(
    `INSERT INTO marker_ads (id, marker_id, ad_id, position) VALUES (?, ?, ?, ?)`
  )

  const run = db.transaction(() => {
    update.run(
      data.timestamp ?? existing.timestamp,
      data.type ?? existing.type,
      'winnerId' in data ? data.winnerId : existing.winnerId,
      now,
      id
    )
    if (data.adIds !== undefined) {
      deleteAds.run(id)
      data.adIds.forEach((adId, idx) => {
        insertAd.run(nanoid(), id, adId, idx)
      })
    }
  })
  run()

  return getMarker(id)!
}

export function deleteMarker(id: string): boolean {
  const result = db.prepare('DELETE FROM ad_markers WHERE id = ?').run(id)
  return (result as { changes: number }).changes > 0
}
