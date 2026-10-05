import type { Entry, StarRating } from './types'
import { normalizeRating } from './types'
import { normalizeTitle } from './title'

export interface MastermindMappedItem {
  entry: Entry
  /** Preferierte Cover-Data-URL (jpeg/png/webp/gif); sonst null. */
  coverDataUrl: string | null
  skipReason?: undefined
}

export interface MastermindSkippedItem {
  entry?: undefined
  coverDataUrl?: undefined
  skipReason: string
}

export type MastermindMapResult = MastermindMappedItem | MastermindSkippedItem

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function pickDataUrl(...candidates: string[]): string | null {
  for (const raw of candidates) {
    const value = raw.trim()
    if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/i.test(value)) return value
  }
  return null
}

function titleFromMastermind(item: Record<string, unknown>): string {
  const style = isRecord(item.styleData) ? item.styleData : null
  const concept = isRecord(item.concept) ? item.concept : null
  const suggestions = style ? asStringArray(style.titleSuggestions) : []
  return normalizeTitle(
    asString(item.libraryTitle).trim()
      || asString(style?.selectedTitleSuggestion).trim()
      || suggestions[0]?.trim()
      || asString(concept?.topic).trim()
      || '',
  )
}

function tagsFromMastermind(item: Record<string, unknown>): string[] {
  const concept = isRecord(item.concept) ? item.concept : null
  const tags = [
    ...asStringArray(concept?.genre),
    ...asStringArray(concept?.mood),
  ]
  const seen = new Set<string>()
  const out: string[] = []
  for (const tag of tags) {
    const trimmed = tag.trim()
    if (!trimmed) continue
    const key = trimmed.toLocaleLowerCase('de')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

function stylePromptFromMastermind(item: Record<string, unknown>): string {
  const style = isRecord(item.styleData) ? item.styleData : null
  return asString(style?.prompt)
}

/**
 * Mappt einen Mastermind-SongHistoryItem auf Desk-Entry.
 * Unbrauchbare Items werden mit skipReason zurückgegeben (nicht geworfen).
 */
export function mapMastermindItem(raw: unknown): MastermindMapResult {
  if (!isRecord(raw)) return { skipReason: 'kein Objekt' }

  const id = asString(raw.id).trim()
  if (!id) return { skipReason: 'keine id' }

  const stylePrompt = stylePromptFromMastermind(raw)
  const lyrics = asString(raw.lyrics)
  if (!stylePrompt.trim() && !lyrics.trim()) {
    return { skipReason: 'weder Style noch Lyrics' }
  }

  const timestamp = typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)
    ? Math.trunc(raw.timestamp)
    : Date.now()
  const lastSaved =
    typeof raw.lastSavedAt === 'number' && Number.isFinite(raw.lastSavedAt)
      ? Math.trunc(raw.lastSavedAt)
      : timestamp

  const versionRaw = raw.version
  const version =
    typeof versionRaw === 'number' && Number.isInteger(versionRaw) && versionRaw >= 1
      ? versionRaw
      : 1

  const groupId = asString(raw.versionGroupId).trim() || id

  const coverDataUrl = pickDataUrl(asString(raw.coverThumbUrl), asString(raw.coverUrl))

  let rating: StarRating = 0
  if (typeof raw.rating === 'number') {
    rating = normalizeRating(raw.rating)
  } else if (raw.isFavorite === true) {
    rating = 5
  }

  return {
    entry: {
      id,
      groupId,
      version,
      title: titleFromMastermind(raw),
      stylePrompt,
      lyrics,
      notes: asString(raw.notes),
      tags: tagsFromMastermind(raw),
      rating,
      published: false,
      publishLinks: [],
      createdAt: timestamp,
      updatedAt: lastSaved,
      audio: null,
      cover: null,
    },
    coverDataUrl,
  }
}

export function mapMastermindArchive(raw: unknown): {
  items: MastermindMappedItem[]
  skipped: number
} {
  if (!Array.isArray(raw)) {
    throw new Error('Mastermind-Import: JSON-Array erwartet')
  }
  const items: MastermindMappedItem[] = []
  let skipped = 0
  for (const row of raw) {
    const mapped = mapMastermindItem(row)
    if (mapped.entry) items.push(mapped)
    else skipped += 1
  }
  return { items, skipped }
}
