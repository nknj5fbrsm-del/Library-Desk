import {
  buildExportBundle,
  parseExportBundleDetailed,
  type EntryExportMediaPaths,
} from '../shared/exportFormat'
import { mediaZipPath, packSpdZip, unpackSpdZip } from '../shared/spdZip'
import type { Entry, ImportLibraryResult } from '../shared/types'
import * as entries from './entriesStore'
import {
  audioMediaId,
  coverMediaId,
  getMedia,
  putMedia,
} from './mediaStore'

async function collectMedia(
  db: IDBDatabase,
  list: Entry[],
): Promise<{
  mediaById: Record<string, EntryExportMediaPaths>
  files: { path: string; data: Uint8Array }[]
}> {
  const mediaById: Record<string, EntryExportMediaPaths> = {}
  const files: { path: string; data: Uint8Array }[] = []

  for (const entry of list) {
    const paths: EntryExportMediaPaths = {}
    if (entry.audio?.kind === 'local') {
      const row = await getMedia(db, audioMediaId(entry.id))
      if (row) {
        const zipPath = mediaZipPath(entry.id, row.originalName || 'audio')
        files.push({ path: zipPath, data: new Uint8Array(await row.blob.arrayBuffer()) })
        paths.audioPath = zipPath
      }
    }
    if (entry.cover) {
      const row = await getMedia(db, coverMediaId(entry.id))
      if (row) {
        const zipPath = mediaZipPath(entry.id, row.originalName || 'cover')
        files.push({ path: zipPath, data: new Uint8Array(await row.blob.arrayBuffer()) })
        paths.coverPath = zipPath
      }
    }
    if (paths.audioPath || paths.coverPath) mediaById[entry.id] = paths
  }

  return { mediaById, files }
}

export async function buildWebSpdZip(db: IDBDatabase, list: Entry[]): Promise<Uint8Array> {
  const { mediaById, files } = await collectMedia(db, list)
  return packSpdZip(buildExportBundle(list, mediaById), files)
}

export async function importWebSpdZip(
  db: IDBDatabase,
  data: Uint8Array,
): Promise<ImportLibraryResult> {
  const { libraryJson, files } = await unpackSpdZip(data)
  const detailed = parseExportBundleDetailed(JSON.parse(libraryJson) as unknown)
  let created = 0
  let updated = 0

  for (const item of detailed.entries) {
    let entry = item.entry
    if (item.audioFile) {
      const bytes = files.get(item.audioFile.path)
      if (bytes) {
        const blob = new Blob([bytes])
        await putMedia(db, audioMediaId(entry.id), blob, item.audioFile.originalName)
        entry = {
          ...entry,
          audio: {
            kind: 'local',
            relativePath: `idb:${audioMediaId(entry.id)}`,
            originalName: item.audioFile.originalName,
          },
        }
      }
    }
    if (item.coverFile) {
      const bytes = files.get(item.coverFile.path)
      if (bytes) {
        const blob = new Blob([bytes])
        await putMedia(db, coverMediaId(entry.id), blob, item.coverFile.originalName)
        entry = {
          ...entry,
          cover: {
            relativePath: `idb:${coverMediaId(entry.id)}`,
            originalName: item.coverFile.originalName,
          },
        }
      }
    }
    const result = await entries.putFullEntry(db, entry)
    if (result === 'created') created += 1
    else updated += 1
  }

  return { created, updated, skipped: 0 }
}
