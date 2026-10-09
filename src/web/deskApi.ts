import { entryExportFilename } from '../shared/exportFormat'
import { looksLikeZip } from '../shared/spdZip'
import type { DeskApi } from '../shared/deskApi'
import type { AttachmentRef, Entry, ImportLibraryResult } from '../shared/types'
import * as entries from './entriesStore'
import { importLibraryJson } from './importLibrary'
import { openDeskDb } from './idb'
import { buildWebSpdZip, importWebSpdZip } from './spdBundle'
import {
  attachmentMediaId,
  audioMediaId,
  coverMediaId,
  deleteEntryMedia,
  deleteMedia,
  getMedia,
  putMedia,
  resolveObjectUrl,
} from './mediaStore'
import * as settings from './settingsStore'

const ATTACHMENT_ACCEPT =
  '.pdf,.txt,.md,.markdown,.doc,.docx,.rtf,.csv,.json,.html,.htm,.odt,application/pdf,text/plain,text/markdown'

function pickFile(accept: string, multiple = false): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}

function pickFiles(accept: string): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = true
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.oncancel = () => resolve([])
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

async function copyOwnedMedia(
  db: IDBDatabase,
  sourceId: string,
  createdId: string,
): Promise<Entry> {
  const source = await entries.getEntry(db, sourceId)
  let created = await entries.getEntry(db, createdId)
  if (!source || !created) throw new Error(`Entry not found: ${sourceId}`)

  if (source.audio?.kind === 'local') {
    const media = await getMedia(db, audioMediaId(sourceId))
    if (media) {
      await putMedia(db, audioMediaId(createdId), media.blob, media.originalName)
      created = await entries.updateEntry(db, createdId, {
        audio: {
          kind: 'local',
          relativePath: `idb:${audioMediaId(createdId)}`,
          originalName: media.originalName,
        },
      })
    } else {
      created = await entries.updateEntry(db, createdId, { audio: null })
    }
  }

  if (source.cover) {
    const media = await getMedia(db, coverMediaId(sourceId))
    if (media) {
      await putMedia(db, coverMediaId(createdId), media.blob, media.originalName)
      created = await entries.updateEntry(db, createdId, {
        cover: {
          relativePath: `idb:${coverMediaId(createdId)}`,
          originalName: media.originalName,
        },
      })
    } else {
      created = await entries.updateEntry(db, createdId, { cover: null })
    }
  }

  if (source.kind === 'general' && source.attachments.length > 0) {
    const attachments: AttachmentRef[] = []
    for (const item of source.attachments) {
      const media = await getMedia(db, attachmentMediaId(sourceId, item.id))
      if (!media) continue
      const nextId = crypto.randomUUID()
      const mediaId = attachmentMediaId(createdId, nextId)
      await putMedia(db, mediaId, media.blob, media.originalName)
      attachments.push({
        id: nextId,
        relativePath: `idb:${mediaId}`,
        originalName: item.originalName,
      })
    }
    created = await entries.updateEntry(db, createdId, { attachments })
  }

  return created!
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
        const existing = await entries.getEntry(db, id)
        await deleteEntryMedia(
          db,
          id,
          existing?.attachments.map((item) => item.id) ?? [],
        )
        await entries.deleteEntry(db, id)
      },
      duplicate: async (id) => {
        const created = await entries.duplicateEntry(db, id)
        return copyOwnedMedia(db, id, created.id)
      },
      createVersion: async (id) => {
        const created = await entries.createVersion(db, id)
        return copyOwnedMedia(db, id, created.id)
      },
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
    attachments: {
      attachLocal: async (entryId) => {
        const existing = await entries.getEntry(db, entryId)
        if (!existing) throw new Error(`Entry not found: ${entryId}`)
        if (existing.kind !== 'general') throw new Error('Attachments only for general prompts')
        const files = await pickFiles(ATTACHMENT_ACCEPT)
        if (files.length === 0) return null
        const added: AttachmentRef[] = []
        for (const file of files) {
          const id = crypto.randomUUID()
          const mediaId = attachmentMediaId(entryId, id)
          await putMedia(db, mediaId, file, file.name)
          added.push({
            id,
            relativePath: `idb:${mediaId}`,
            originalName: file.name,
          })
        }
        return entries.updateEntry(db, entryId, {
          attachments: [...existing.attachments, ...added],
        })
      },
      remove: async (entryId, attachmentId) => {
        const existing = await entries.getEntry(db, entryId)
        if (!existing) throw new Error(`Entry not found: ${entryId}`)
        const next = existing.attachments.filter((item) => item.id !== attachmentId)
        const updated = await entries.updateEntry(db, entryId, { attachments: next })
        await deleteMedia(db, attachmentMediaId(entryId, attachmentId))
        return updated
      },
      open: async (entryId, attachmentId) => {
        const entry = await entries.getEntry(db, entryId)
        const target = entry?.attachments.find((item) => item.id === attachmentId)
        const media = await getMedia(db, attachmentMediaId(entryId, attachmentId))
        if (!target || !media) throw new Error('Anhang-Datei fehlt')
        downloadBlob(target.originalName, media.blob)
        return { filePath: target.originalName }
      },
      clear: async (entryId) => {
        const existing = await entries.getEntry(db, entryId)
        for (const item of existing?.attachments ?? []) {
          await deleteMedia(db, attachmentMediaId(entryId, item.id))
        }
        return entries.updateEntry(db, entryId, { attachments: [] })
      },
    },
    io: {
      exportLibrary: async () => {
        const all = await entries.listEntries(db, { search: '', facet: 'all', kind: 'all', sort: 'title' })
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
