import { db } from '../client'
import type { AdSet, Asset } from '@/types'
import { nanoid } from '@/lib/nanoid'
import { getAsset } from './assets'

interface AdSetRow {
  id: string
  name: string
  created_at: string
  updated_at: string
}

interface AdSetAdRow {
  id: string
  ad_set_id: string
  asset_id: string
  position: number
}

function hydrateSet(row: AdSetRow): AdSet {
  const memberRows = db
    .prepare('SELECT * FROM ad_set_ads WHERE ad_set_id = ? ORDER BY position ASC')
    .all(row.id) as AdSetAdRow[]
  const assets: Asset[] = memberRows
    .map((m) => getAsset(m.asset_id))
    .filter(Boolean) as Asset[]
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assets,
  }
}

export function listAdSets(): AdSet[] {
  const rows = db
    .prepare('SELECT * FROM ad_sets ORDER BY created_at DESC')
    .all() as AdSetRow[]
  return rows.map(hydrateSet)
}

export function getAdSet(id: string): AdSet | null {
  const row = db.prepare('SELECT * FROM ad_sets WHERE id = ?').get(id) as AdSetRow | null
  return row ? hydrateSet(row) : null
}

export function createAdSet(data: { name: string; assetIds: string[] }): AdSet {
  const id = nanoid()
  const now = new Date().toISOString()
  db.prepare(
    'INSERT INTO ad_sets (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run(id, data.name, now, now)
  const stmt = db.prepare(
    'INSERT INTO ad_set_ads (id, ad_set_id, asset_id, position) VALUES (?, ?, ?, ?)'
  )
  data.assetIds.forEach((assetId, i) => stmt.run(nanoid(), id, assetId, i))
  return getAdSet(id)!
}

export function addAssetsToSet(setId: string, assetIds: string[]): AdSet | null {
  const set = db.prepare('SELECT * FROM ad_sets WHERE id = ?').get(setId) as AdSetRow | null
  if (!set) return null
  const maxPos = (db.prepare(
    'SELECT MAX(position) as max_pos FROM ad_set_ads WHERE ad_set_id = ?'
  ).get(setId) as { max_pos: number | null }).max_pos ?? -1
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO ad_set_ads (id, ad_set_id, asset_id, position) VALUES (?, ?, ?, ?)'
  )
  assetIds.forEach((assetId, i) => stmt.run(nanoid(), setId, assetId, maxPos + 1 + i))
  db.prepare('UPDATE ad_sets SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), setId)
  return getAdSet(setId)
}

export function updateAdSet(id: string, data: { name?: string; assetIds?: string[] }): AdSet | null {
  const row = db.prepare('SELECT * FROM ad_sets WHERE id = ?').get(id) as AdSetRow | null
  if (!row) return null
  const now = new Date().toISOString()
  if (data.name) {
    db.prepare('UPDATE ad_sets SET name = ?, updated_at = ? WHERE id = ?').run(data.name, now, id)
  }
  if (data.assetIds) {
    db.prepare('DELETE FROM ad_set_ads WHERE ad_set_id = ?').run(id)
    const stmt = db.prepare(
      'INSERT INTO ad_set_ads (id, ad_set_id, asset_id, position) VALUES (?, ?, ?, ?)'
    )
    data.assetIds.forEach((assetId, i) => stmt.run(nanoid(), id, assetId, i))
    db.prepare('UPDATE ad_sets SET updated_at = ? WHERE id = ?').run(now, id)
  }
  return getAdSet(id)
}

export function deleteAdSet(id: string): boolean {
  const result = db.prepare('DELETE FROM ad_sets WHERE id = ?').run(id)
  return result.changes > 0
}
