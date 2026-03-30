import path from 'path'
import { MIGRATIONS } from './schema'

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => any }

const DB_PATH = path.join(process.cwd(), 'prisma', 'dev.db')

declare global {
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof createDatabase> | undefined
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createDatabase(): any {
  const db = new DatabaseSync(DB_PATH)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(MIGRATIONS)
  // column migrations
  try {
    db.exec(`ALTER TABLE assets ADD COLUMN content_type TEXT NOT NULL DEFAULT 'content' CHECK (content_type IN ('content', 'ad'));`)
  } catch { /* already exists */ }
  try {
    db.exec(`ALTER TABLE episode_clips ADD COLUMN start_offset REAL NOT NULL DEFAULT 0;`)
  } catch { /* already exists */ }
  try {
    db.exec(`ALTER TABLE episode_clips ADD COLUMN end_offset REAL NOT NULL DEFAULT -1;`)
  } catch { /* already exists */ }
  try {
    db.exec(`ALTER TABLE published_ab_tests ADD COLUMN clip_timestamp REAL NOT NULL DEFAULT 0;`)
  } catch { /* already exists */ }
  try {
    db.exec(`ALTER TABLE published_ab_tests ADD COLUMN variant_names TEXT;`)
  } catch { /* already exists */ }
  try {
    db.exec(`ALTER TABLE episode_clips ADD COLUMN ab_test_group_id TEXT;`)
  } catch { /* already exists */ }
  try {
    db.exec(`ALTER TABLE episode_clips ADD COLUMN ab_test_variant_ids TEXT;`)
  } catch { /* already exists */ }
  try {
    db.exec(`ALTER TABLE episode_clips ADD COLUMN ab_test_group_name TEXT;`)
  } catch { /* already exists */ }
  return db
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any =
  globalThis.__db ?? (globalThis.__db = createDatabase())
