import type { DeskExportBundle, Entry } from '../shared/types'
import type { AppDatabase } from './db'
import { getEntry } from './entriesRepo'

function audioJson(audio: Entry['audio']): string | null {
  return audio ? JSON.stringify(audio) : null
}

function entryForWrite(entry: Entry): Entry {
  if (entry.audio?.kind === 'local') {
    return { ...entry, audio: null }
  }
  return entry
}

function insertEntry(db: AppDatabase, entry: Entry): void {
  db.prepare(
    `INSERT INTO entries (
      id, group_id, version, title, style_prompt, lyrics, notes,
      tags_json, is_power, created_at, updated_at, audio_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.id,
    entry.groupId,
    entry.version,
    entry.title,
    entry.stylePrompt,
    entry.lyrics,
    entry.notes,
    JSON.stringify(entry.tags),
    entry.isPower ? 1 : 0,
    entry.createdAt,
    entry.updatedAt,
    audioJson(entry.audio),
  )
}

function updateEntry(db: AppDatabase, entry: Entry): void {
  db.prepare(
    `UPDATE entries SET
      group_id = ?, version = ?, title = ?, style_prompt = ?, lyrics = ?, notes = ?,
      tags_json = ?, is_power = ?, created_at = ?, updated_at = ?, audio_json = ?
    WHERE id = ?`,
  ).run(
    entry.groupId,
    entry.version,
    entry.title,
    entry.stylePrompt,
    entry.lyrics,
    entry.notes,
    JSON.stringify(entry.tags),
    entry.isPower ? 1 : 0,
    entry.createdAt,
    entry.updatedAt,
    audioJson(entry.audio),
    entry.id,
  )
}

export function importBundle(
  db: AppDatabase,
  bundle: DeskExportBundle & { entries: Entry[] },
): { created: number; updated: number } {
  let created = 0
  let updated = 0

  const apply = db.transaction((entries: Entry[]) => {
    for (const raw of entries) {
      const entry = entryForWrite(raw)
      if (getEntry(db, entry.id)) {
        updateEntry(db, entry)
        updated += 1
      } else {
        insertEntry(db, entry)
        created += 1
      }
    }
  })

  apply(bundle.entries)
  return { created, updated }
}
