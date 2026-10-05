export type AudioRef =
  | { kind: 'local'; relativePath: string; originalName: string }
  | { kind: 'url'; href: string; label?: string }

export interface CoverRef {
  relativePath: string
  originalName: string
}

/** 0 = keine Bewertung, 1–5 Sterne */
export type StarRating = 0 | 1 | 2 | 3 | 4 | 5

export interface Entry {
  id: string
  groupId: string
  version: number
  title: string
  stylePrompt: string
  lyrics: string
  notes: string
  tags: string[]
  rating: StarRating
  createdAt: number
  updatedAt: number
  audio: AudioRef | null
  cover: CoverRef | null
}

export type LibraryFacet = 'all' | 'rated' | { tag: string }
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

export interface ImportLibraryResult {
  created: number
  updated: number
  skipped: number
}

export function normalizeRating(value: unknown): StarRating {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  const n = Math.trunc(value)
  if (n <= 0) return 0
  if (n >= 5) return 5
  return n as StarRating
}
