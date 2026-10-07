import { entryExportFilename } from '../shared/exportFormat'
import { looksLikeZip } from '../shared/spdZip'
import type { DeskApi } from '../shared/deskApi'
import type { ImportLibraryResult } from '../shared/types'
import * as entries from './entriesStore'
import { importLibraryJson } from './importLibrary'
import { openDeskDb } from './idb'
import { buildWebSpdZip, importWebSpdZip } from './spdBundle'
import {
  audioMediaId,
  coverMediaId,
  deleteEntryMedia,
  deleteMedia,
  getMedia,
  putMedia,
  resolveObjectUrl,
} from './mediaStore'
import * as settings from './settingsStore'

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function createWebDeskApi(): Promise<DeskApi> {
  const db = await openDeskDb()

  const api: DeskApi = {
    entries: {
      list: (query) => entries.listEntries(db, query),
      get: (id) => entries.getEntry(db, id),
      create: (input) => entries.createEntry(db, input),
      update: (id, patch) => entries.updateEntry(db, id, patch),
      delete: async (id) => {
        await deleteEntryMedia(db, id)
        await entries.deleteEntry(db, id)
      },
      duplicate: async (id) => {
        const source = await entries.getEntry(db, id)
        const created = await entries.duplicateEntry(db, id)
        if (source?.audio?.kind === 'local') {
          const media = await getMedia(db, audioMediaId(id))
          if (media) {
            await putMedia(db, audioMediaId(created.id), media.blob, media.originalName)
            return entries.updateEntry(db, created.id, {
              audio: {
                kind: 'local',
                relativePath: `idb:${audioMediaId(created.id)}`,
                originalName: media.originalName,
              },
            })
          }
        }
        if (source?.cover) {
          const media = await getMedia(db, coverMediaId(id))
          if (media) {
            await putMedia(db, coverMediaId(created.id), media.blob, media.originalName)
            return entries.updateEntry(db, created.id, {
              cover: {
                relativePath: `idb:${coverMediaId(created.id)}`,
                originalName: media.originalName,
              },
            })
          }
        }
        return created
      },
      createVersion: (id) => entries.createVersion(db, id),
    },
    audio: {
      attachLocal: async (entryId) => {
        const file = await pickFile('audio/*')
        if (!file) return null
        await putMedia(db, audioMediaId(entryId), file, file.name)
        return entries.updateEntry(db, entryId, {
          audio: {
            kind: 'local',
            relativePath: `idb:${audioMediaId(entryId)}`,
            originalName: file.name,
          },
        })
      },
      setUrl: (entryId, href, label) =>
        entries.updateEntry(db, entryId, {
          audio: label ? { kind: 'url', href, label } : { kind: 'url', href },
        }),
      clear: async (entryId) => {
        await deleteMedia(db, audioMediaId(entryId))
        return entries.updateEntry(db, entryId, { audio: null })
      },
      resolveLocalUrl: (entryId) => resolveObjectUrl(db, audioMediaId(entryId)),
    },
    cover: {
      resolveUrl: (entryId) => resolveObjectUrl(db, coverMediaId(entryId)),
      attachLocal: async (entryId) => {
        const file = await pickFile('image/*')
        if (!file) return null
        await putMedia(db, coverMediaId(entryId), file, file.name)
        return entries.updateEntry(db, entryId, {
          cover: {
            relativePath: `idb:${coverMediaId(entryId)}`,
            originalName: file.name,
          },
        })
      },
      download: async (entryId) => {
        const entry = await entries.getEntry(db, entryId)
        const media = await getMedia(db, coverMediaId(entryId))
        if (!entry?.cover || !media) return null
        downloadBlob(entry.cover.originalName || 'cover.png', media.blob)
        return { filePath: entry.cover.originalName || 'cover.png' }
      },
      clear: async (entryId) => {
        await deleteMedia(db, coverMediaId(entryId))
        return entries.updateEntry(db, entryId, { cover: null })
      },
    },
    io: {
      exportLibrary: async () => {
        const all = await entries.listEntries(db, { search: '', facet: 'all', sort: 'title' })
        const zip = await buildWebSpdZip(db, all)
        const name = `library-desk-${new Date().toISOString().slice(0, 10)}.spd.zip`
        downloadBlob(name, new Blob([zip], { type: 'application/zip' }))
        return { filePath: name }
      },
      exportEntry: async (id) => {
        const entry = await entries.getEntry(db, id)
        if (!entry) throw new Error(`Entry not found: ${id}`)
        const name = entryExportFilename(entry)
        const zip = await buildWebSpdZip(db, [entry])
        downloadBlob(name, new Blob([zip], { type: 'application/zip' }))
        return { filePath: name }
      },
      importLibrary: async (): Promise<ImportLibraryResult | null> => {
        const file = await pickFile('.spd.zip,.zip,.spd.json,.json,application/zip,application/json')
        if (!file) return null
        const buffer = new Uint8Array(await file.arrayBuffer())
        const lower = file.name.toLowerCase()
        if (looksLikeZip(buffer) || lower.endsWith('.zip') || lower.endsWith('.spd.zip')) {
          return importWebSpdZip(db, buffer)
        }
        const raw = JSON.parse(new TextDecoder().decode(buffer)) as unknown
        return importLibraryJson(db, raw)
      },
    },
    settings: {
      get: (key) => settings.getSetting(db, key),
      set: (key, value) => settings.setSetting(db, key, value),
    },
    shell: {
      openExternal: async (url) => {
        window.open(url, '_blank', 'noopener,noreferrer')
      },
    },
    edit: {
      onUndo: (handler) => {
        const listener = (event: KeyboardEvent) => {
          const mod = event.metaKey || event.ctrlKey
          if (mod && event.key.toLowerCase() === 'z' && !event.shiftKey) {
            event.preventDefault()
            handler()
          }
        }
        window.addEventListener('keydown', listener)
        return () => window.removeEventListener('keydown', listener)
      },
      onRedo: (handler) => {
        const listener = (event: KeyboardEvent) => {
          const mod = event.metaKey || event.ctrlKey
          if (
            (mod && event.key.toLowerCase() === 'z' && event.shiftKey)
            || (mod && event.key.toLowerCase() === 'y')
          ) {
            event.preventDefault()
            handler()
          }
        }
        window.addEventListener('keydown', listener)
        return () => window.removeEventListener('keydown', listener)
      },
    },
  }

  return api
}
