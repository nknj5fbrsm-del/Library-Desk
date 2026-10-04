import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { AudioRef } from '../shared/types'
import { buildExportBundle, parseExportBundle } from '../shared/exportFormat'
import type { CreateEntryInput, ListQuery, UpdateEntryPatch } from '../shared/deskApi'
import {
  copyLocalAudio,
  deleteEntryAudio,
  resolveLocalAudioFile,
} from './audioFs'
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
import { importBundle } from './importExport'
import { getSetting, setSetting } from './settingsRepo'

const LIBRARY_FILTERS = [
  { name: 'Suno Prompt Desk', extensions: ['spd.json', 'json'] },
]

const AUDIO_FILTERS = [
  {
    name: 'Audio',
    extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'aiff', 'aif', 'webm'],
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

  function copyOwnedLocalAudio(sourceId: string, createdId: string) {
    const source = getEntry(db, sourceId)
    const created = getEntry(db, createdId)
    if (!source || !created) throw new Error(`Entry not found: ${sourceId}`)
    if (source.audio?.kind !== 'local') return created
    const filePath = resolveLocalAudioFile(audioRoot, source.id, source.audio.relativePath)
    if (!existsSync(filePath)) return updateEntry(db, created.id, { audio: null })
    const copied = copyLocalAudio(userData, created.id, filePath)
    return updateEntry(db, created.id, {
      audio: {
        kind: 'local',
        relativePath: copied.relativePath,
        originalName: source.audio.originalName,
      },
    })
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
  })
  ipcMain.handle('entries:duplicate', (_event, id: string) => {
    const created = duplicateEntry(db, id)
    return copyOwnedLocalAudio(id, created.id)
  })
  ipcMain.handle('entries:createVersion', (_event, id: string) => {
    const created = createVersion(db, id)
    return copyOwnedLocalAudio(id, created.id)
  })

  ipcMain.handle('audio:attachLocal', async (_event, entryId: string) => {
    const existing = getEntry(db, entryId)
    if (!existing) throw new Error(`Entry not found: ${entryId}`)
    const picked = await openFile({
      title: 'Audiodatei wählen',
      filters: AUDIO_FILTERS,
      properties: ['openFile'],
    })
    if (picked.canceled || picked.filePaths.length === 0) return existing
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
    return pathToFileURL(filePath).href
  })

  ipcMain.handle('io:exportLibrary', async () => {
    const picked = await saveFile({
      title: 'Bibliothek exportieren',
      defaultPath: 'library.spd.json',
      filters: LIBRARY_FILTERS,
    })
    if (picked.canceled || !picked.filePath) return null
    const entries = listEntries(db, { search: '', facet: 'all', sort: 'newest' })
    writeFileSync(picked.filePath, buildExportBundle(entries), 'utf8')
    return { filePath: picked.filePath }
  })

  ipcMain.handle('io:importLibrary', async () => {
    const picked = await openFile({
      title: 'Bibliothek importieren',
      filters: LIBRARY_FILTERS,
      properties: ['openFile'],
    })
    if (picked.canceled || picked.filePaths.length === 0) return null
    const raw: unknown = JSON.parse(readFileSync(picked.filePaths[0], 'utf8'))
    return importBundle(db, parseExportBundle(raw))
  })

  ipcMain.handle('settings:get', (_event, key: string) => getSetting(db, key))
  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    setSetting(db, key, value)
  })
  ipcMain.handle('shell:openExternal', (_event, url: string) => shell.openExternal(assertHttpUrl(url)))
}
