export type AudioRef =
  | { kind: 'local'; relativePath: string; originalName: string }
  | { kind: 'url'; href: string; label?: string }

export interface Entry {
  id: string
  groupId: string
  version: number
  title: string
  stylePrompt: string
  lyrics: string
  notes: string
  tags: string[]
  isPower: boolean
  createdAt: number
  updatedAt: number
  audio: AudioRef | null
}

export type LibraryFacet = 'all' | 'power' | { tag: string }
export type SortMode = 'newest' | 'title' | 'updated'

export interface VersionGroup {
  key: string
  representative: Entry
  versions: Entry[]
}

export interface DeskExportBundle {
  format: 'suno-prompt-desk'
  formatVersion: 1
  exportedAt: string
  entries: unknown[]
}
