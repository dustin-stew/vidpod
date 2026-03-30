export const MIGRATIONS = `
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

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('video', 'audio')),
    content_type TEXT NOT NULL DEFAULT 'content' CHECK (content_type IN ('content', 'ad')),
    duration REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS episode_clips (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    clip_type TEXT NOT NULL CHECK (clip_type IN ('content', 'ad')),
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id)
  );

  CREATE TABLE IF NOT EXISTS ads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    folder TEXT,
    file_path TEXT NOT NULL,
    duration REAL NOT NULL DEFAULT 0,
    thumbnail_path TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ad_markers (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    timestamp REAL NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('AUTO', 'STATIC', 'AB_TEST')),
    winner_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS marker_ads (
    id TEXT PRIMARY KEY,
    marker_id TEXT NOT NULL,
    ad_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    UNIQUE(marker_id, ad_id),
    FOREIGN KEY (marker_id) REFERENCES ad_markers(id) ON DELETE CASCADE,
    FOREIGN KEY (ad_id) REFERENCES ads(id)
  );

  CREATE TABLE IF NOT EXISTS ad_sets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ad_set_ads (
    id TEXT PRIMARY KEY,
    ad_set_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    UNIQUE(ad_set_id, asset_id),
    FOREIGN KEY (ad_set_id) REFERENCES ad_sets(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id)
  );

  CREATE TABLE IF NOT EXISTS ab_test_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ab_test_group_sets (
    id TEXT PRIMARY KEY,
    ab_test_group_id TEXT NOT NULL,
    ad_set_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    UNIQUE(ab_test_group_id, ad_set_id),
    FOREIGN KEY (ab_test_group_id) REFERENCES ab_test_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (ad_set_id) REFERENCES ad_sets(id)
  );

  CREATE TABLE IF NOT EXISTS published_ab_tests (
    id TEXT PRIMARY KEY,
    episode_id TEXT NOT NULL,
    ab_test_group_id TEXT NOT NULL,
    ab_test_group_name TEXT NOT NULL,
    episode_title TEXT NOT NULL,
    clip_timestamp REAL NOT NULL DEFAULT 0,
    published_at TEXT NOT NULL,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
  );
`

export const ALTER_MIGRATIONS = `
  ALTER TABLE assets ADD COLUMN content_type TEXT NOT NULL DEFAULT 'content' CHECK (content_type IN ('content', 'ad'));
`
