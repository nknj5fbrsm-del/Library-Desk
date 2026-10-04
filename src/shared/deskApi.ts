import type { AudioRef, Entry, LibraryFacet, SortMode } from './types'

export interface CreateEntryInput {
  title?: string
  stylePrompt?: string
  lyrics?: string
  notes?: string
  tags?: string[]
  isPower?: boolean
  audio?: AudioRef | null
}

export type UpdateEntryPatch = CreateEntryInput

export interface ListQuery {
  search: string
  facet: LibraryFacet
  sort: SortMode
}

export interface DeskApi {
  entries: {
    list(query: ListQuery): Promise<Entry[]>
    get(id: string): Promise<Entry | null>
    create(input: CreateEntryInput): Promise<Entry>
    update(id: string, patch: UpdateEntryPatch): Promise<Entry>
    delete(id: string): Promise<void>
    duplicate(id: string): Promise<Entry>
    createVersion(id: string): Promise<Entry>
  }
  audio: {
    attachLocal(entryId: string): Promise<Entry>
    setUrl(entryId: string, href: string, label?: string): Promise<Entry>
    clear(entryId: string): Promise<Entry>
    resolveLocalUrl(entryId: string): Promise<string | null>
  }
  io: {
    exportLibrary(): Promise<{ filePath: string } | null>
    importLibrary(): Promise<{ created: number; updated: number } | null>
  }
  settings: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
  }
  shell: {
    openExternal(url: string): Promise<void>
  }
}
