import type { AppDatabase } from './db'

export function getSetting(db: AppDatabase, key: string): string | null {
  const row = db
    .prepare<[string], { value: string }>('SELECT value FROM settings WHERE key = ?')
    .get(key)
  return row?.value ?? null
}

export function setSetting(db: AppDatabase, key: string, value: string): void {
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value)
}
