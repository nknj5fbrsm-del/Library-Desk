export type AudioRef =
  | { kind: 'local'; relativePath: string; originalName: string }
  | { kind: 'url'; href: string; label?: string }

export interface CoverRef {
  relativePath: string
  originalName: string
}

/** 0 = keine Bewertung, 1–5 Sterne */
export type StarRating = 0 | 1 | 2 | 3 | 4 | 5

export interface PublishLink {
  id: string
  label: string
  href: string
}

/** `suno` = Style/Lyrics-Workflow; `general` = freier KI-/Arbeits-Prompt. */
export type EntryKind = 'suno' | 'general'

/** Toolbar-Filter: alle Arten oder nur eine. */
export type KindFilter = 'all' | EntryKind

export interface Entry {
  id: string
  groupId: string
  version: number
  kind: EntryKind
  title: string
  stylePrompt: string
  lyrics: string
  /** Haupttext des allgemeinen Prompts (nur `kind: general` relevant). */
  promptBody: string
  /** Optionale Rolle / System-Anweisung. */
  systemRole: string
  /** Wie der Prompt arbeitet, was er macht, wie er anzuwenden ist. */
  usageGuide: string
  notes: string
  tags: string[]
  rating: StarRating
  published: boolean
  publishLinks: PublishLink[]
  createdAt: number
  updatedAt: number
  audio: AudioRef | null
  cover: CoverRef | null
}

export type LibraryFacet = 'all' | 'rated' | 'published' | { tag: string }
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

export function normalizePublishLinks(links: PublishLink[] | undefined): PublishLink[] {
  if (!links) return []
  const out: PublishLink[] = []
  for (const link of links) {
    if (!link || typeof link.id !== 'string' || link.id.length === 0) continue
    const href = typeof link.href === 'string' ? link.href.trim() : ''
    if (!href) continue
    const label = typeof link.label === 'string' ? link.label.trim() : ''
    out.push({ id: link.id, label, href })
  }
  return out
}
