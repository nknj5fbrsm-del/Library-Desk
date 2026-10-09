import Database from 'better-sqlite3'

export type AppDatabase = Database.Database

const SCHEMA = `
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  style_prompt TEXT NOT NULL DEFAULT '',
  lyrics TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  is_power INTEGER NOT NULL DEFAULT 0,
  rating INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  audio_json TEXT,
  cover_json TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  publish_links_json TEXT NOT NULL DEFAULT '[]',
  kind TEXT NOT NULL DEFAULT 'suno',
  prompt_body TEXT NOT NULL DEFAULT '',
  system_role TEXT NOT NULL DEFAULT '',
  usage_guide TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entries_group ON entries(group_id);
CREATE INDEX IF NOT EXISTS idx_entries_updated ON entries(updated_at);
`

export function openDatabase(dbPath: string): AppDatabase {
  const db = new Database(dbPath)
  migrate(db)
  return db
}

export function migrate(db: AppDatabase): void {
  // CREATE TABLE IF NOT EXISTS does not add new columns to existing DBs.
  // Indexes that reference new columns must run only after ALTER TABLE.
  db.exec(SCHEMA)
  const columns = db
    .prepare<[], { name: string }>('PRAGMA table_info(entries)')
    .all()
    .map((column) => column.name)
  if (!columns.includes('cover_json')) {
    db.exec('ALTER TABLE entries ADD COLUMN cover_json TEXT')
  }
  if (!columns.includes('rating')) {
    db.exec('ALTER TABLE entries ADD COLUMN rating INTEGER NOT NULL DEFAULT 0')
    db.exec('UPDATE entries SET rating = 5 WHERE is_power = 1 AND rating = 0')
  }
  if (!columns.includes('published')) {
    db.exec('ALTER TABLE entries ADD COLUMN published INTEGER NOT NULL DEFAULT 0')
  }
  if (!columns.includes('publish_links_json')) {
    db.exec(`ALTER TABLE entries ADD COLUMN publish_links_json TEXT NOT NULL DEFAULT '[]'`)
  }
  if (!columns.includes('kind')) {
    db.exec(`ALTER TABLE entries ADD COLUMN kind TEXT NOT NULL DEFAULT 'suno'`)
  }
  if (!columns.includes('prompt_body')) {
    db.exec(`ALTER TABLE entries ADD COLUMN prompt_body TEXT NOT NULL DEFAULT ''`)
  }
  if (!columns.includes('system_role')) {
    db.exec(`ALTER TABLE entries ADD COLUMN system_role TEXT NOT NULL DEFAULT ''`)
  }
  if (!columns.includes('usage_guide')) {
    db.exec(`ALTER TABLE entries ADD COLUMN usage_guide TEXT NOT NULL DEFAULT ''`)
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_entries_kind ON entries(kind)')
}
