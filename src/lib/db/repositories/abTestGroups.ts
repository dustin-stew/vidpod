import { db } from '../client'
import type { AbTestGroup } from '@/types'
import { nanoid } from '@/lib/nanoid'
import { getAdSet } from './adSets'

interface AbTestGroupRow {
  id: string
  name: string
  created_at: string
  updated_at: string
}

interface AbTestGroupSetRow {
  id: string
  ab_test_group_id: string
  ad_set_id: string
  position: number
}

function hydrateGroup(row: AbTestGroupRow): AbTestGroup {
  const memberRows = db
    .prepare('SELECT * FROM ab_test_group_sets WHERE ab_test_group_id = ? ORDER BY position ASC')
    .all(row.id) as AbTestGroupSetRow[]
  const adSets = memberRows
    .map((m) => getAdSet(m.ad_set_id))
    .filter(Boolean) as NonNullable<ReturnType<typeof getAdSet>>[]
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    adSets,
  }
}

export function listAbTestGroups(): AbTestGroup[] {
  const rows = db
    .prepare('SELECT * FROM ab_test_groups ORDER BY created_at DESC')
    .all() as AbTestGroupRow[]
  return rows.map(hydrateGroup)
}

export function getAbTestGroup(id: string): AbTestGroup | null {
  const row = db.prepare('SELECT * FROM ab_test_groups WHERE id = ?').get(id) as AbTestGroupRow | null
  return row ? hydrateGroup(row) : null
}

export function createAbTestGroup(data: { name: string; adSetIds: string[] }): AbTestGroup {
  const id = nanoid()
  const now = new Date().toISOString()
  db.prepare(
    'INSERT INTO ab_test_groups (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).run(id, data.name, now, now)
  const stmt = db.prepare(
    'INSERT INTO ab_test_group_sets (id, ab_test_group_id, ad_set_id, position) VALUES (?, ?, ?, ?)'
  )
  data.adSetIds.forEach((adSetId, i) => stmt.run(nanoid(), id, adSetId, i))
  return getAbTestGroup(id)!
}

export function addSetsToGroup(groupId: string, adSetIds: string[]): AbTestGroup | null {
  const row = db.prepare('SELECT * FROM ab_test_groups WHERE id = ?').get(groupId) as AbTestGroupRow | null
  if (!row) return null
  const maxPos = (db.prepare(
    'SELECT MAX(position) as max_pos FROM ab_test_group_sets WHERE ab_test_group_id = ?'
  ).get(groupId) as { max_pos: number | null }).max_pos ?? -1
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO ab_test_group_sets (id, ab_test_group_id, ad_set_id, position) VALUES (?, ?, ?, ?)'
  )
  adSetIds.forEach((adSetId, i) => stmt.run(nanoid(), groupId, adSetId, maxPos + 1 + i))
  db.prepare('UPDATE ab_test_groups SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), groupId)
  return getAbTestGroup(groupId)
}

export function updateAbTestGroup(id: string, data: { name?: string; adSetIds?: string[] }): AbTestGroup | null {
  const row = db.prepare('SELECT * FROM ab_test_groups WHERE id = ?').get(id) as AbTestGroupRow | null
  if (!row) return null
  const now = new Date().toISOString()
  if (data.name) {
    db.prepare('UPDATE ab_test_groups SET name = ?, updated_at = ? WHERE id = ?').run(data.name, now, id)
  }
  if (data.adSetIds) {
    db.prepare('DELETE FROM ab_test_group_sets WHERE ab_test_group_id = ?').run(id)
    const stmt = db.prepare(
      'INSERT INTO ab_test_group_sets (id, ab_test_group_id, ad_set_id, position) VALUES (?, ?, ?, ?)'
    )
    data.adSetIds.forEach((adSetId, i) => stmt.run(nanoid(), id, adSetId, i))
    db.prepare('UPDATE ab_test_groups SET updated_at = ? WHERE id = ?').run(now, id)
  }
  return getAbTestGroup(id)
}

export function deleteAbTestGroup(id: string): boolean {
  const result = db.prepare('DELETE FROM ab_test_groups WHERE id = ?').run(id)
  return result.changes > 0
}
