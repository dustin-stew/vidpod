/**
 * seed the database with demo data
 * run: npx tsx scripts/seed.ts
 */

import path from 'path'
import fs from 'fs'
import { MIGRATIONS } from '../src/lib/db/schema'

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => any }

const DB_PATH = path.join(__dirname, '..', 'prisma', 'dev.db')

// ensure prisma dir exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')
db.exec(MIGRATIONS)

// column migrations
const migrations = [
  `ALTER TABLE assets ADD COLUMN content_type TEXT NOT NULL DEFAULT 'content' CHECK (content_type IN ('content', 'ad'))`,
  `ALTER TABLE episode_clips ADD COLUMN start_offset REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE episode_clips ADD COLUMN end_offset REAL NOT NULL DEFAULT -1`,
  `ALTER TABLE published_ab_tests ADD COLUMN clip_timestamp REAL NOT NULL DEFAULT 0`,
  `ALTER TABLE published_ab_tests ADD COLUMN variant_names TEXT`,
  `ALTER TABLE episode_clips ADD COLUMN ab_test_group_id TEXT`,
  `ALTER TABLE episode_clips ADD COLUMN ab_test_variant_ids TEXT`,
  `ALTER TABLE episode_clips ADD COLUMN ab_test_group_name TEXT`,
  `ALTER TABLE assets ADD COLUMN folder TEXT`,
]
for (const sql of migrations) {
  try { db.exec(sql) } catch { /* already exists */ }
}

const now = new Date().toISOString()

// ids
const ASSET_CONTENT = 'seed-asset-im-serious'
const ASSET_AD_LILBITS = 'seed-asset-lilbits'
const ASSET_AD_TENNIS = 'seed-asset-tennis'
const AD_SET = 'seed-adgroup-preroll'
const AB_TEST_GROUP = 'seed-abtest-1'
const AB_TEST_GROUP_SET = 'seed-abtest-group-1'
const EPISODE = 'seed-episode-only-absolutes'
const CLIP_1 = 'seed-clip-1'
const CLIP_2 = 'seed-clip-2'
const CLIP_AD = 'seed-clip-ad'
const CLIP_3 = 'seed-clip-3'
const PUB_AB = 'seed-pub-ab-1'

function clearSeeded() {
  db.exec(`DELETE FROM published_ab_tests WHERE id LIKE 'seed-%'`)
  db.exec(`DELETE FROM episode_clips WHERE id LIKE 'seed-%'`)
  db.exec(`DELETE FROM ab_test_group_sets WHERE id LIKE 'seed-%'`)
  db.exec(`DELETE FROM ab_test_groups WHERE id LIKE 'seed-%'`)
  db.exec(`DELETE FROM ad_set_ads WHERE id LIKE 'seed-%'`)
  db.exec(`DELETE FROM ad_sets WHERE id LIKE 'seed-%'`)
  db.exec(`DELETE FROM episodes WHERE id LIKE 'seed-%'`)
  db.exec(`DELETE FROM assets WHERE id LIKE 'seed-%'`)
}

function seed() {
  clearSeeded()

  // assets
  db.prepare(`INSERT INTO assets (id, name, file_path, type, content_type, duration, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    ASSET_CONTENT, 'im serious', '/uploads/assets/896724285104db17-im_serious.mp4',
    'video', 'content', 63.32, now)

  db.prepare(`INSERT INTO assets (id, name, file_path, type, content_type, duration, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    ASSET_AD_LILBITS, 'lilbits bit', '/uploads/assets/0f8cc8177d3a3f10-lilbits_bit.mp4',
    'video', 'ad', 21.7, now)

  db.prepare(`INSERT INTO assets (id, name, file_path, type, content_type, duration, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    ASSET_AD_TENNIS, 'tennis ball', '/uploads/assets/2359347d4011ffe4-tennis_ball.mp4',
    'video', 'ad', 8.01, now)

  // ad set: pre-roll bundle (lilbits + tennis ball)
  db.prepare(`INSERT INTO ad_sets (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)`).run(AD_SET, 'food+sports', now, now)

  db.prepare(`INSERT INTO ad_set_ads (id, ad_set_id, asset_id, position)
    VALUES (?, ?, ?, ?)`).run('seed-aga-1', AD_SET, ASSET_AD_LILBITS, 0)
  db.prepare(`INSERT INTO ad_set_ads (id, ad_set_id, asset_id, position)
    VALUES (?, ?, ?, ?)`).run('seed-aga-2', AD_SET, ASSET_AD_TENNIS, 1)

  // ab test group: test 1 (contains pre-roll bundle)
  db.prepare(`INSERT INTO ab_test_groups (id, name, created_at, updated_at)
    VALUES (?, ?, ?, ?)`).run(AB_TEST_GROUP, 'food sports intratest', now, now)

  db.prepare(`INSERT INTO ab_test_group_sets (id, ab_test_group_id, ad_set_id, position)
    VALUES (?, ?, ?, ?)`).run(AB_TEST_GROUP_SET, AB_TEST_GROUP, AD_SET, 0)

  // episode: only absolutes
  db.prepare(`INSERT INTO episodes (id, title, video_path, duration, published_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    EPISODE, 'Only Absolutes', '', 0, now, now, now)

  // clips: content → content → ab test ad → content
  db.prepare(`INSERT INTO episode_clips (id, episode_id, asset_id, clip_type, order_index, start_offset, end_offset, ab_test_group_id, ab_test_variant_ids, ab_test_group_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    CLIP_1, EPISODE, ASSET_CONTENT, 'content', 0, 0.0, 11.7, null, null, null, now)

  db.prepare(`INSERT INTO episode_clips (id, episode_id, asset_id, clip_type, order_index, start_offset, end_offset, ab_test_group_id, ab_test_variant_ids, ab_test_group_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    CLIP_2, EPISODE, ASSET_CONTENT, 'content', 1, 11.7, 21.45, null, null, null, now)

  db.prepare(`INSERT INTO episode_clips (id, episode_id, asset_id, clip_type, order_index, start_offset, end_offset, ab_test_group_id, ab_test_variant_ids, ab_test_group_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    CLIP_AD, EPISODE, ASSET_AD_LILBITS, 'ad', 2, 0.0, -1.0,
    AB_TEST_GROUP,
    JSON.stringify([ASSET_AD_LILBITS, ASSET_AD_TENNIS]),
    'food sports intratest', now)

  db.prepare(`INSERT INTO episode_clips (id, episode_id, asset_id, clip_type, order_index, start_offset, end_offset, ab_test_group_id, ab_test_variant_ids, ab_test_group_name, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    CLIP_3, EPISODE, ASSET_CONTENT, 'content', 3, 21.45, -1.0, null, null, null, now)

  // published ab test for analytics
  db.prepare(`INSERT INTO published_ab_tests (id, episode_id, ab_test_group_id, ab_test_group_name, episode_title, clip_timestamp, variant_names, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    PUB_AB, EPISODE, AB_TEST_GROUP, 'food sports intratest @ 00:21', 'Only Absolutes', 21.45,
    JSON.stringify(['lilbits bit', 'tennis ball']), now)

  console.log('seeded: 3 assets, 1 ad set, 1 ab test group, 1 episode with 4 clips, 1 published ab test')
}

seed()
db.close()
