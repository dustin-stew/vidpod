import { db } from '../client'
import { nanoid } from '@/lib/nanoid'
import type { PublishedAbTest } from '@/types'

interface Row {
  id: string
  episode_id: string
  ab_test_group_id: string
  ab_test_group_name: string
  episode_title: string
  clip_timestamp: number
  published_at: string
  variant_names: string | null
}

function hydrate(row: Row): PublishedAbTest {
  let variantNames: string[] = []
  try { variantNames = row.variant_names ? JSON.parse(row.variant_names) : [] } catch { /* */ }
  return {
    id: row.id,
    episodeId: row.episode_id,
    abTestGroupId: row.ab_test_group_id,
    abTestGroupName: row.ab_test_group_name,
    episodeTitle: row.episode_title,
    clipTimestamp: row.clip_timestamp ?? 0,
    publishedAt: row.published_at,
    variantNames,
  }
}

export function listPublishedAbTests(): PublishedAbTest[] {
  const rows = db
    .prepare('SELECT * FROM published_ab_tests ORDER BY published_at DESC')
    .all() as Row[]
  return rows.map(hydrate)
}

export function publishAbTest(params: {
  episodeId: string
  abTestGroupId: string
  abTestGroupName: string
  episodeTitle: string
  clipTimestamp: number
  variantNames?: string[]
}): PublishedAbTest {
  const id = nanoid()
  const now = new Date().toISOString()
  const variantNamesJson = params.variantNames ? JSON.stringify(params.variantNames) : null
  db.prepare(
    'INSERT INTO published_ab_tests (id, episode_id, ab_test_group_id, ab_test_group_name, episode_title, clip_timestamp, variant_names, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, params.episodeId, params.abTestGroupId, params.abTestGroupName, params.episodeTitle, params.clipTimestamp, variantNamesJson, now)
  return { id, ...params, variantNames: params.variantNames ?? [], publishedAt: now }
}

export function deletePublishedAbTest(id: string): void {
  db.prepare('DELETE FROM published_ab_tests WHERE id = ?').run(id)
}
