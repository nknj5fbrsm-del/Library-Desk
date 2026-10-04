import type { DeskExportBundle, Entry, ImportLibraryResult } from '../shared/types'
import { mapMastermindArchive } from '../shared/mastermindImport'
import { parseExportBundle } from '../shared/exportFormat'
import type { AppDatabase } from './db'
import { writeCoverFromDataUrl } from './coverFs'
import { upsertFullEntry } from './entriesRepo'

function entryForDeskWrite(entry: Entry): Entry {
  let next = entry
  if (next.audio?.kind === 'local') {
    next = { ...next, audio: null }
  }
  // Desk-JSON enthält keine Cover-Binaries
  if (next.cover) {
    next = { ...next, cover: null }
  }
  return next
}

export function importDeskBundle(
  db: AppDatabase,
  bundle: DeskExportBundle & { entries: Entry[] },
): ImportLibraryResult {
  let created = 0
  let updated = 0

  const apply = db.transaction((entries: Entry[]) => {
    for (const raw of entries) {
      const entry = entryForDeskWrite(raw)
      const result = upsertFullEntry(db, entry)
      if (result === 'created') created += 1
      else updated += 1
    }
  })

  apply(bundle.entries)
  return { created, updated, skipped: 0 }
}

/** @deprecated use importDeskBundle */
export const importBundle = importDeskBundle

export function importMastermindArchive(
  db: AppDatabase,
  userData: string,
  raw: unknown,
): ImportLibraryResult {
  const { items, skipped } = mapMastermindArchive(raw)
  let created = 0
  let updated = 0

  const apply = db.transaction(() => {
    for (const item of items) {
      let entry = item.entry
      if (item.coverDataUrl) {
        const cover = writeCoverFromDataUrl(userData, entry.id, item.coverDataUrl)
        if (cover) entry = { ...entry, cover }
      }
      const result = upsertFullEntry(db, entry)
      if (result === 'created') created += 1
      else updated += 1
    }
  })

  apply()
  return { created, updated, skipped }
}

export function importLibraryJson(
  db: AppDatabase,
  userData: string,
  raw: unknown,
): ImportLibraryResult {
  if (
    typeof raw === 'object'
    && raw !== null
    && !Array.isArray(raw)
    && (raw as { format?: unknown }).format === 'suno-prompt-desk'
  ) {
    return importDeskBundle(db, parseExportBundle(raw))
  }
  if (Array.isArray(raw)) {
    return importMastermindArchive(db, userData, raw)
  }
  throw new Error('Unbekanntes Import-Format (Desk-Bundle oder Mastermind-Array erwartet)')
}
