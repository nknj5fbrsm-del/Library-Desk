import type {
  AudioRef,
  CoverRef,
  Entry,
  LibraryFacet,
  PublishLink,
  SortMode,
  StarRating,
} from './types'
import type { ImportLibraryResult } from './types'

export interface CreateEntryInput {
  title?: string
  stylePrompt?: string
  lyrics?: string
  notes?: string
  tags?: string[]
  rating?: StarRating
  published?: boolean
  publishLinks?: PublishLink[]
  audio?: AudioRef | null
  cover?: CoverRef | null
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
    attachLocal(entryId: string): Promise<Entry | null>
    setUrl(entryId: string, href: string, label?: string): Promise<Entry>
    clear(entryId: string): Promise<Entry>
    resolveLocalUrl(entryId: string): Promise<string | null>
  }
  cover: {
    resolveUrl(entryId: string): Promise<string | null>
    attachLocal(entryId: string): Promise<Entry | null>
    download(entryId: string): Promise<{ filePath: string } | null>
    clear(entryId: string): Promise<Entry>
  }
  io: {
    exportLibrary(): Promise<{ filePath: string } | null>
    exportEntry(id: string): Promise<{ filePath: string } | null>
    importLibrary(): Promise<ImportLibraryResult | null>
  }
  settings: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
  }
  shell: {
    openExternal(url: string): Promise<void>
  }
  edit: {
    onUndo(handler: () => void): () => void
    onRedo(handler: () => void): () => void
  }
}
