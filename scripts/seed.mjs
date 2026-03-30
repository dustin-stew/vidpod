/**
 * Seed script — copies root video files to public/uploads and inserts asset records.
 * Run: node scripts/seed.mjs
 * Safe to re-run: clears placeholder episodes/assets first, skips already-copied files.
 */

import { DatabaseSync } from 'node:sqlite'
import { randomBytes } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VIDPOD = join(__dirname, '..')
const REPO_ROOT = join(VIDPOD, '..') // flightstory/
const DB_PATH = join(VIDPOD, 'prisma', 'dev.db')

const UPLOADS = join(VIDPOD, 'public', 'uploads', 'assets')
mkdirSync(UPLOADS, { recursive: true })

const db = new DatabaseSync(DB_PATH)
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = OFF;')

// Ensure tables exist (idempotent)
db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('video', 'audio')),
    content_type TEXT NOT NULL DEFAULT 'content' CHECK (content_type IN ('content', 'ad')),
    duration REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS episodes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    video_path TEXT NOT NULL DEFAULT '',
    duration REAL NOT NULL DEFAULT 0,
    thumbnail_path TEXT,
    published_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS episode_clips (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    clip_type TEXT NOT NULL CHECK (clip_type IN ('content', 'ad')),
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`)

// Idempotent column add for existing DBs
try {
  db.exec(`ALTER TABLE assets ADD COLUMN content_type TEXT NOT NULL DEFAULT 'content' CHECK (content_type IN ('content', 'ad'));`)
} catch { /* already exists */ }

// ── Wipe placeholder data ────────────────────────────────────────────────────

db.exec(`DELETE FROM episode_clips; DELETE FROM episodes; DELETE FROM assets;`)
console.log('Cleared existing episodes and assets.')

// ── Files to seed ────────────────────────────────────────────────────────────

const FILES = [
  { src: 'im_serious.mp4',    contentType: 'content' },
  { src: 'tennis_ball.mp4',   contentType: 'ad'      },
  { src: 'lilbits_bit.mp4',   contentType: 'ad'      },
]

function nameFromFilename(src) {
  return src.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function nanoid() { return randomBytes(12).toString('base64url') }
function now()    { return new Date().toISOString() }

function copyToUploads(srcName) {
  const src = join(REPO_ROOT, srcName)
  if (!existsSync(src)) {
    console.warn(`  ⚠ skipping ${srcName} — file not found at ${src}`)
    return null
  }
  const destName = `${randomBytes(8).toString('hex')}-${srcName}`
  const dest = join(UPLOADS, destName)
  copyFileSync(src, dest)
  // Return as public URL
  const idx = dest.indexOf('/public/')
  return dest.slice(idx + '/public'.length)
}

// ── Seed ─────────────────────────────────────────────────────────────────────

for (const { src, contentType } of FILES) {
  const filePath = copyToUploads(src)
  if (!filePath) continue

  const name = nameFromFilename(src)
  db.prepare(
    `INSERT INTO assets (id, name, file_path, type, content_type, duration, created_at)
     VALUES (?, ?, ?, 'video', ?, 0, ?)`
  ).run(nanoid(), name, filePath, contentType, now())

  console.log(`  [${contentType}] ${name}`)
}

console.log('\nSeed complete.')
db.close()
