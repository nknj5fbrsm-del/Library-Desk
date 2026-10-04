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
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  audio_json TEXT
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
  db.exec(SCHEMA)
}
