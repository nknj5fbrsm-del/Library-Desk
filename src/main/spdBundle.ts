import { existsSync, readFileSync } from 'node:fs'
import { basename } from 'node:path'
import {
  buildExportBundle,
  parseExportBundleDetailed,
  type EntryExportMediaPaths,
} from '../shared/exportFormat'
import { mediaZipPath, packSpdZip, unpackSpdZip } from '../shared/spdZip'
import type { Entry, ImportLibraryResult } from '../shared/types'
import { resolveLocalAudioFile, writeAudioFromBuffer } from './audioFs'
import { resolveLocalCoverFile, writeCoverFromBuffer } from './coverFs'
import type { AppDatabase } from './db'
import { upsertFullEntry } from './entriesRepo'

function collectMedia(
  userData: string,
  audioRoot: string,
  coverRoot: string,
  entries: Entry[],
): {
  mediaById: Record<string, EntryExportMediaPaths>
  files: { path: string; data: Uint8Array }[]
} {
  const mediaById: Record<string, EntryExportMediaPaths> = {}
  const files: { path: string; data: Uint8Array }[] = []

  for (const entry of entries) {
    const paths: EntryExportMediaPaths = {}
    if (entry.audio?.kind === 'local') {
      try {
        const filePath = resolveLocalAudioFile(audioRoot, entry.id, entry.audio.relativePath)
        if (existsSync(filePath)) {
          const zipPath = mediaZipPath(entry.id, basename(entry.audio.relativePath))
          files.push({ path: zipPath, data: new Uint8Array(readFileSync(filePath)) })
          paths.audioPath = zipPath
        }
      } catch {
        // missing / invalid → metadata-only
      }
    }
    if (entry.cover) {
      try {
        const filePath = resolveLocalCoverFile(coverRoot, entry.id, entry.cover.relativePath)
        if (existsSync(filePath)) {
          const zipPath = mediaZipPath(entry.id, basename(entry.cover.relativePath))
          files.push({ path: zipPath, data: new Uint8Array(readFileSync(filePath)) })
          paths.coverPath = zipPath
        }
      } catch {
        // missing / invalid → metadata-only
      }
    }
    if (paths.audioPath || paths.coverPath) mediaById[entry.id] = paths
  }

  return { mediaById, files }
}

export async function buildSpdZipBuffer(
  userData: string,
  audioRoot: string,
  coverRoot: string,
  entries: Entry[],
): Promise<Uint8Array> {
  const { mediaById, files } = collectMedia(userData, audioRoot, coverRoot, entries)
  const json = buildExportBundle(entries, mediaById)
  return packSpdZip(json, files)
}

export async function importSpdZipBuffer(
  db: AppDatabase,
  userData: string,
  data: Uint8Array,
): Promise<ImportLibraryResult> {
  const { libraryJson, files } = await unpackSpdZip(data)
  const raw: unknown = JSON.parse(libraryJson)
  const detailed = parseExportBundleDetailed(raw)
  let created = 0
  let updated = 0

  for (const item of detailed.entries) {
    let entry = item.entry
    if (item.audioFile) {
      const bytes = files.get(item.audioFile.path)
      if (bytes) {
        const written = writeAudioFromBuffer(
          userData,
          entry.id,
          item.audioFile.originalName,
          bytes,
        )
        entry = {
          ...entry,
          audio: {
            kind: 'local',
            relativePath: written.relativePath,
            originalName: written.originalName,
          },
        }
      }
    }
    if (item.coverFile) {
      const bytes = files.get(item.coverFile.path)
      if (bytes) {
        const written = writeCoverFromBuffer(
          userData,
          entry.id,
          item.coverFile.originalName,
          bytes,
        )
        entry = { ...entry, cover: written }
      }
    }
    const result = upsertFullEntry(db, entry)
    if (result === 'created') created += 1
    else updated += 1
  }

  return { created, updated, skipped: 0 }
}
