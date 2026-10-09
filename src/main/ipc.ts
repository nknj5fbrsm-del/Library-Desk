import { copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { AudioRef } from '../shared/types'
import { entryExportFilename } from '../shared/exportFormat'
import { looksLikeZip } from '../shared/spdZip'
import type { CreateEntryInput, ListQuery, UpdateEntryPatch } from '../shared/deskApi'
import {
  copyLocalAudio,
  deleteEntryAudio,
  localPlaybackUrl,
  resolveLocalAudioFile,
} from './audioFs'
import {
  attachmentsRootFor,
  copyAttachmentsBetweenEntries,
  copyLocalAttachment,
  deleteAttachmentFile,
  deleteEntryAttachments,
  resolveLocalAttachmentFile,
} from './attachmentFs'
import {
  copyCoverBetweenEntries,
  copyLocalCover,
  coverDisplayUrl,
  coverRootFor,
  deleteEntryCover,
  resolveLocalCoverFile,
} from './coverFs'
import type { AppDatabase } from './db'
import {
  createEntry,
  createVersion,
  deleteEntry,
  duplicateEntry,
  getEntry,
  listEntries,
  updateEntry,
} from './entriesRepo'
import { importLibraryJson } from './importExport'
import { getSetting, setSetting } from './settingsRepo'
import { buildSpdZipBuffer, importSpdZipBuffer } from './spdBundle'

const EXPORT_ZIP_FILTERS = [
  { name: 'Library Desk Zip', extensions: ['spd.zip', 'zip'] },
]

const IMPORT_FILTERS = [
  { name: 'Library Desk', extensions: ['spd.zip', 'zip', 'spd.json', 'json'] },
]

const AUDIO_FILTERS = [
  {
    name: 'Audio',
    extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'aiff', 'aif', 'webm'],
  },
]

const ATTACHMENT_FILTERS = [
  {
    name: 'Dokumente',
    extensions: ['pdf', 'txt', 'md', 'markdown', 'doc', 'docx', 'rtf', 'csv', 'json', 'html', 'htm', 'odt'],
  },
]

function dialogParent(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

function openFile(options: Electron.OpenDialogOptions) {
  const parent = dialogParent()
  return parent ? dialog.showOpenDialog(parent, options) : dialog.showOpenDialog(options)
}

function saveFile(options: Electron.SaveDialogOptions) {
  const parent = dialogParent()
  return parent ? dialog.showSaveDialog(parent, options) : dialog.showSaveDialog(options)
}

function urlAudio(href: string, label?: string): Extract<AudioRef, { kind: 'url' }> {
  const trimmed = href.trim()
  if (!trimmed) throw new Error('Audio URL is empty')
  const trimmedLabel = label?.trim()
  if (!trimmedLabel) return { kind: 'url', href: trimmed }
  return { kind: 'url', href: trimmed, label: trimmedLabel }
}

function assertHttpUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs can be opened')
  }
  return parsed.href
}

export function registerIpc(db: AppDatabase, userData: string): void {
  const audioRoot = join(userData, 'audio')
  const coverRoot = coverRootFor(userData)
  const attachmentsRoot = attachmentsRootFor(userData)

  function copyOwnedMedia(sourceId: string, createdId: string) {
    let created = getEntry(db, createdId)
    const source = getEntry(db, sourceId)
    if (!source || !created) throw new Error(`Entry not found: ${sourceId}`)

    if (source.audio?.kind === 'local') {
      const filePath = resolveLocalAudioFile(audioRoot, source.id, source.audio.relativePath)
      if (!existsSync(filePath)) {
        created = updateEntry(db, created.id, { audio: null })
      } else {
        const copied = copyLocalAudio(userData, created.id, filePath)
        created = updateEntry(db, created.id, {
          audio: {
            kind: 'local',
            relativePath: copied.relativePath,
            originalName: source.audio.originalName,
          },
        })
      }
    }

    if (source.cover) {
      try {
        const copied = copyCoverBetweenEntries(
          userData,
          source.id,
          created.id,
          source.cover.relativePath,
        )
        created = updateEntry(db, created.id, { cover: copied })
      } catch {
        created = updateEntry(db, created.id, { cover: null })
      }
    }

    if (source.kind === 'general' && source.attachments.length > 0) {
      const copied = copyAttachmentsBetweenEntries(
        userData,
        source.id,
        created.id,
        source.attachments,
      )
      created = updateEntry(db, created.id, { attachments: copied })
    }

    return created
  }

  ipcMain.handle('entries:list', (_event, query: ListQuery) => listEntries(db, query))
  ipcMain.handle('entries:get', (_event, id: string) => getEntry(db, id))
  ipcMain.handle('entries:create', (_event, input: CreateEntryInput) => createEntry(db, input))
  ipcMain.handle('entries:update', (_event, id: string, patch: UpdateEntryPatch) =>
    updateEntry(db, id, patch),
  )
  ipcMain.handle('entries:delete', (_event, id: string) => {
    deleteEntry(db, id)
    deleteEntryAudio(userData, id)
    deleteEntryCover(userData, id)
    deleteEntryAttachments(userData, id)
  })
  ipcMain.handle('entries:duplicate', (_event, id: string) => {
    const created = duplicateEntry(db, id)
    return copyOwnedMedia(id, created.id)
  })
  ipcMain.handle('entries:createVersion', (_event, id: string) => {
    const created = createVersion(db, id)
    return copyOwnedMedia(id, created.id)
  })

  ipcMain.handle('audio:attachLocal', async (_event, entryId: string) => {
    const existing = getEntry(db, entryId)
    if (!existing) throw new Error(`Entry not found: ${entryId}`)
    const picked = await openFile({
      title: 'Audiodatei wählen',
      filters: AUDIO_FILTERS,
      properties: ['openFile'],
    })
    if (picked.canceled || picked.filePaths.length === 0) return null
    const copied = copyLocalAudio(userData, entryId, picked.filePaths[0])
    return updateEntry(db, entryId, {
      audio: { kind: 'local', relativePath: copied.relativePath, originalName: copied.originalName },
    })
  })

  ipcMain.handle('audio:setUrl', (_event, entryId: string, href: string, label?: string) => {
    const updated = updateEntry(db, entryId, { audio: urlAudio(href, label) })
    deleteEntryAudio(userData, entryId)
    return updated
  })

  ipcMain.handle('audio:clear', (_event, entryId: string) => {
    const updated = updateEntry(db, entryId, { audio: null })
    deleteEntryAudio(userData, entryId)
    return updated
  })

  ipcMain.handle('audio:resolveLocalUrl', (_event, entryId: string) => {
    const entry = getEntry(db, entryId)
    if (entry?.audio?.kind !== 'local') return null
    const filePath = resolveLocalAudioFile(audioRoot, entryId, entry.audio.relativePath)
    if (!existsSync(filePath)) return null
    return localPlaybackUrl(entryId, entry.audio.relativePath)
  })

  ipcMain.handle('cover:resolveUrl', (_event, entryId: string) => {
    const entry = getEntry(db, entryId)
    if (!entry?.cover) return null
    const filePath = resolveLocalCoverFile(coverRoot, entryId, entry.cover.relativePath)
    if (!existsSync(filePath)) return null
    return coverDisplayUrl(entryId, entry.cover.relativePath)
  })

  ipcMain.handle('cover:attachLocal', async (_event, entryId: string) => {
    const existing = getEntry(db, entryId)
    if (!existing) throw new Error(`Entry not found: ${entryId}`)
    const picked = await openFile({
      title: 'Cover wählen',
      filters: [
        { name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
      ],
      properties: ['openFile'],
    })
    if (picked.canceled || picked.filePaths.length === 0) return null
    const copied = copyLocalCover(userData, entryId, picked.filePaths[0])
    return updateEntry(db, entryId, { cover: copied })
  })

  ipcMain.handle('cover:download', async (_event, entryId: string) => {
    const entry = getEntry(db, entryId)
    if (!entry?.cover) throw new Error('Kein Cover vorhanden')
    const filePath = resolveLocalCoverFile(coverRoot, entryId, entry.cover.relativePath)
    if (!existsSync(filePath)) throw new Error('Cover-Datei fehlt')
    const picked = await saveFile({
      title: 'Cover speichern',
      defaultPath: entry.cover.originalName || 'cover.png',
      filters: [
        { name: 'Bilder', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
      ],
    })
    if (picked.canceled || !picked.filePath) return null
    copyFileSync(filePath, picked.filePath)
    return { filePath: picked.filePath }
  })

  ipcMain.handle('cover:clear', (_event, entryId: string) => {
    const updated = updateEntry(db, entryId, { cover: null })
    deleteEntryCover(userData, entryId)
    return updated
  })

  ipcMain.handle('attachments:attachLocal', async (_event, entryId: string) => {
    const existing = getEntry(db, entryId)
    if (!existing) throw new Error(`Entry not found: ${entryId}`)
    if (existing.kind !== 'general') throw new Error('Attachments only for general prompts')
    const picked = await openFile({
      title: 'Dateien anhängen',
      filters: ATTACHMENT_FILTERS,
      properties: ['openFile', 'multiSelections'],
    })
    if (picked.canceled || picked.filePaths.length === 0) return null
    const added = picked.filePaths.map((filePath) => copyLocalAttachment(userData, entryId, filePath))
    return updateEntry(db, entryId, {
      attachments: [...existing.attachments, ...added],
    })
  })

  ipcMain.handle('attachments:remove', (_event, entryId: string, attachmentId: string) => {
    const existing = getEntry(db, entryId)
    if (!existing) throw new Error(`Entry not found: ${entryId}`)
    const target = existing.attachments.find((item) => item.id === attachmentId)
    const next = existing.attachments.filter((item) => item.id !== attachmentId)
    const updated = updateEntry(db, entryId, { attachments: next })
    if (target) deleteAttachmentFile(userData, entryId, target.relativePath)
    return updated
  })

  ipcMain.handle('attachments:open', async (_event, entryId: string, attachmentId: string) => {
    const entry = getEntry(db, entryId)
    const target = entry?.attachments.find((item) => item.id === attachmentId)
    if (!target) throw new Error('Anhang nicht gefunden')
    const filePath = resolveLocalAttachmentFile(attachmentsRoot, entryId, target.relativePath)
    if (!existsSync(filePath)) throw new Error('Anhang-Datei fehlt')
    const error = await shell.openPath(filePath)
    if (error) throw new Error(error)
    return { filePath }
  })

  ipcMain.handle('attachments:clear', (_event, entryId: string) => {
    const updated = updateEntry(db, entryId, { attachments: [] })
    deleteEntryAttachments(userData, entryId)
    return updated
  })

  ipcMain.handle('io:exportLibrary', async () => {
    const picked = await saveFile({
      title: 'Bibliothek sichern',
      defaultPath: 'library.spd.zip',
      filters: EXPORT_ZIP_FILTERS,
    })
    if (picked.canceled || !picked.filePath) return null
    const entries = listEntries(db, { search: '', facet: 'all', kind: 'all', sort: 'newest' })
    const zip = await buildSpdZipBuffer(userData, audioRoot, coverRoot, attachmentsRoot, entries)
    writeFileSync(picked.filePath, Buffer.from(zip))
    return { filePath: picked.filePath }
  })

  ipcMain.handle('io:exportEntry', async (_event, id: string) => {
    const entry = getEntry(db, id)
    if (!entry) throw new Error(`Entry not found: ${id}`)
    const picked = await saveFile({
      title: 'Eintrag exportieren',
      defaultPath: entryExportFilename(entry),
      filters: EXPORT_ZIP_FILTERS,
    })
    if (picked.canceled || !picked.filePath) return null
    const zip = await buildSpdZipBuffer(userData, audioRoot, coverRoot, attachmentsRoot, [entry])
    writeFileSync(picked.filePath, Buffer.from(zip))
    return { filePath: picked.filePath }
  })

  ipcMain.handle('io:importLibrary', async () => {
    const picked = await openFile({
      title: 'Bibliothek importieren (Desk oder Mastermind)',
      filters: IMPORT_FILTERS,
      properties: ['openFile'],
    })
    if (picked.canceled || picked.filePaths.length === 0) return null
    const filePath = picked.filePaths[0]
    const bytes = new Uint8Array(readFileSync(filePath))
    const lower = filePath.toLowerCase()
    if (looksLikeZip(bytes) || lower.endsWith('.zip') || lower.endsWith('.spd.zip')) {
      return importSpdZipBuffer(db, userData, bytes)
    }
    const raw: unknown = JSON.parse(Buffer.from(bytes).toString('utf8'))
    return importLibraryJson(db, userData, raw)
  })

  ipcMain.handle('settings:get', (_event, key: string) => getSetting(db, key))
  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    setSetting(db, key, value)
  })
  ipcMain.handle('shell:openExternal', (_event, url: string) => shell.openExternal(assertHttpUrl(url)))
}
