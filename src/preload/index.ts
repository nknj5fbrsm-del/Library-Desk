import { contextBridge, ipcRenderer } from 'electron'
import type { Entry } from '../shared/types'
import type { CreateEntryInput, DeskApi, ListQuery, UpdateEntryPatch } from '../shared/deskApi'

const desk: DeskApi = {
  entries: {
    list: (query: ListQuery) => ipcRenderer.invoke('entries:list', query),
    get: (id: string) => ipcRenderer.invoke('entries:get', id),
    create: (input: CreateEntryInput) => ipcRenderer.invoke('entries:create', input),
    update: (id: string, patch: UpdateEntryPatch) => ipcRenderer.invoke('entries:update', id, patch),
    delete: (id: string) => ipcRenderer.invoke('entries:delete', id),
    duplicate: (id: string) => ipcRenderer.invoke('entries:duplicate', id),
    createVersion: (id: string) => ipcRenderer.invoke('entries:createVersion', id),
  },
  audio: {
    attachLocal: (entryId: string): Promise<Entry | null> =>
      ipcRenderer.invoke('audio:attachLocal', entryId),
    setUrl: (entryId: string, href: string, label?: string) =>
      ipcRenderer.invoke('audio:setUrl', entryId, href, label),
    clear: (entryId: string) => ipcRenderer.invoke('audio:clear', entryId),
    resolveLocalUrl: (entryId: string) => ipcRenderer.invoke('audio:resolveLocalUrl', entryId),
  },
  cover: {
    resolveUrl: (entryId: string) => ipcRenderer.invoke('cover:resolveUrl', entryId),
    attachLocal: (entryId: string) => ipcRenderer.invoke('cover:attachLocal', entryId),
    download: (entryId: string) => ipcRenderer.invoke('cover:download', entryId),
    clear: (entryId: string) => ipcRenderer.invoke('cover:clear', entryId),
  },
  io: {
    exportLibrary: () => ipcRenderer.invoke('io:exportLibrary'),
    importLibrary: () => ipcRenderer.invoke('io:importLibrary'),
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
}

contextBridge.exposeInMainWorld('desk', desk)
