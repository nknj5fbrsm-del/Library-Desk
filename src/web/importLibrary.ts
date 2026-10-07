import { parseExportBundle } from '../shared/exportFormat'
import { mapMastermindArchive } from '../shared/mastermindImport'
import type { Entry, ImportLibraryResult } from '../shared/types'
import * as entries from './entriesStore'
import { coverMediaId, putMedia } from './mediaStore'

function entryForDeskWrite(entry: Entry): Entry {
  let next = entry
  if (next.audio?.kind === 'local') {
    next = { ...next, audio: null }
  }
  if (next.cover) {
    next = { ...next, cover: null }
  }
  return next
}

async function dataUrlToBlob(dataUrl: string): Promise<{ blob: Blob; name: string } | null> {
  try {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const mime = blob.type || 'image/png'
    const ext = mime.split('/')[1] || 'png'
    return { blob, name: `cover.${ext}` }
  } catch {
    return null
  }
}

export async function importLibraryJson(
  db: IDBDatabase,
  raw: unknown,
): Promise<ImportLibraryResult> {
  if (
    typeof raw === 'object'
    && raw !== null
    && !Array.isArray(raw)
    && (raw as { format?: unknown }).format === 'suno-prompt-desk'
  ) {
    const bundle = parseExportBundle(raw)
    let created = 0
    let updated = 0
    for (const rawEntry of bundle.entries) {
      const entry = entryForDeskWrite(rawEntry)
      const result = await entries.putFullEntry(db, entry)
      if (result === 'created') created += 1
      else updated += 1
    }
    return { created, updated, skipped: 0 }
  }

  if (Array.isArray(raw)) {
    const { items, skipped } = mapMastermindArchive(raw)
    let created = 0
    let updated = 0
    for (const item of items) {
      let entry = item.entry
      if (item.coverDataUrl) {
        const parsed = await dataUrlToBlob(item.coverDataUrl)
        if (parsed) {
          await putMedia(db, coverMediaId(entry.id), parsed.blob, parsed.name)
          entry = {
            ...entry,
            cover: { relativePath: `idb:${coverMediaId(entry.id)}`, originalName: parsed.name },
          }
        }
      }
      const result = await entries.putFullEntry(db, entry)
      if (result === 'created') created += 1
      else updated += 1
    }
    return { created, updated, skipped }
  }

  throw new Error('Unbekanntes Import-Format (Desk-Bundle oder Mastermind-Array erwartet)')
}
