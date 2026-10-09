import {
  buildExportBundle,
  parseExportBundleDetailed,
  type EntryExportMediaPaths,
} from '../shared/exportFormat'
import { mediaZipPath, packSpdZip, unpackSpdZip } from '../shared/spdZip'
import type { AttachmentRef, Entry, ImportLibraryResult } from '../shared/types'
import * as entries from './entriesStore'
import {
  attachmentMediaId,
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
    if (entry.attachments.length > 0) {
      const attachmentPaths: { id: string; path: string }[] = []
      for (const item of entry.attachments) {
        const row = await getMedia(db, attachmentMediaId(entry.id, item.id))
        if (!row) continue
        const zipPath = mediaZipPath(entry.id, `att_${item.id}_${row.originalName || 'file'}`)
        files.push({ path: zipPath, data: new Uint8Array(await row.blob.arrayBuffer()) })
        attachmentPaths.push({ id: item.id, path: zipPath })
      }
      if (attachmentPaths.length > 0) paths.attachmentPaths = attachmentPaths
    }
    if (paths.audioPath || paths.coverPath || paths.attachmentPaths) {
      mediaById[entry.id] = paths
    }
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
    if (item.attachmentFiles.length > 0 && entry.kind === 'general') {
      const attachments: AttachmentRef[] = []
      for (const file of item.attachmentFiles) {
        const bytes = files.get(file.path)
        if (!bytes) continue
        const blob = new Blob([bytes])
        const mediaId = attachmentMediaId(entry.id, file.id)
        await putMedia(db, mediaId, blob, file.originalName)
        attachments.push({
          id: file.id,
          relativePath: `idb:${mediaId}`,
          originalName: file.originalName,
        })
      }
      entry = { ...entry, attachments }
    }
    const result = await entries.putFullEntry(db, entry)
    if (result === 'created') created += 1
    else updated += 1
  }

  return { created, updated, skipped: 0 }
}
