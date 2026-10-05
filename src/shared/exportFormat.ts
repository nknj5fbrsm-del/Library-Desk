import type { AudioRef, DeskExportBundle, Entry, PublishLink, StarRating } from './types'
import { normalizePublishLinks, normalizeRating } from './types'
import { normalizeTitle } from './title'

export interface ExportAudioLocal {
  kind: 'local'
  included: false
  originalName: string
}

export type ExportAudio = Extract<AudioRef, { kind: 'url' }> | ExportAudioLocal | null

export interface ExportEntryRow {
  id: string
  groupId: string
  version: number
  title: string
  stylePrompt: string
  lyrics: string
  notes: string
  tags: string[]
  rating: StarRating
  published: boolean
  publishLinks: PublishLink[]
  createdAt: string
  updatedAt: string
  audio: ExportAudio
  cover: { included: false; originalName: string } | null
}

function invalid(detail: string): never {
  throw new Error(`Invalid suno-prompt-desk export: ${detail}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exportAudio(audio: AudioRef | null): ExportAudio {
  if (!audio) return null
  if (audio.kind === 'local') {
    return { kind: 'local', included: false, originalName: audio.originalName }
  }
  if (audio.label) return { kind: 'url', href: audio.href, label: audio.label }
  return { kind: 'url', href: audio.href }
}

export function entryToExportRow(entry: Entry): ExportEntryRow {
  return {
    id: entry.id,
    groupId: entry.groupId,
    version: entry.version,
    title: entry.title,
    stylePrompt: entry.stylePrompt,
    lyrics: entry.lyrics,
    notes: entry.notes,
    tags: [...entry.tags],
    rating: entry.rating,
    published: entry.published,
    publishLinks: normalizePublishLinks(entry.publishLinks),
    createdAt: new Date(entry.createdAt).toISOString(),
    updatedAt: new Date(entry.updatedAt).toISOString(),
    audio: exportAudio(entry.audio),
    cover: entry.cover
      ? { included: false as const, originalName: entry.cover.originalName }
      : null,
  }
}

export function buildExportBundle(entries: Entry[]): string {
  const bundle: DeskExportBundle = {
    format: 'suno-prompt-desk',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    entries: entries.map(entryToExportRow),
  }
  return JSON.stringify(bundle)
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string') invalid(field)
  return value
}

function requireNonEmpty(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) invalid(field)
  return value
}

function requireVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) invalid('version')
  return value
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') invalid(field)
  return value
}

function parseRating(raw: Record<string, unknown>): StarRating {
  if (raw.rating !== undefined) return normalizeRating(raw.rating)
  if (raw.isPower === true) return 5
  if (raw.isPower === false) return 0
  return 0
}

function requireIso(value: unknown, field: string): number {
  if (typeof value !== 'string') invalid(field)
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) invalid(field)
  return ms
}

function requireTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string')) invalid('tags')
  return [...value]
}

function parsePublishLinks(value: unknown): PublishLink[] {
  if (!Array.isArray(value)) invalid('publishLinks')
  const links: PublishLink[] = []
  for (const item of value) {
    if (!isRecord(item)) invalid('publishLinks')
    const id = requireNonEmpty(item.id, 'publishLinks.id')
    const href = requireText(item.href, 'publishLinks.href')
    const label = item.label === undefined ? '' : requireText(item.label, 'publishLinks.label')
    links.push({ id, label, href })
  }
  return normalizePublishLinks(links)
}

function parseAudio(value: unknown): AudioRef | null {
  if (value === null || value === undefined) return null
  if (!isRecord(value)) invalid('audio')
  if (value.kind === 'local') return null
  if (value.kind !== 'url') invalid('audio')
  const href = requireNonEmpty(value.href, 'href')
  if (value.label === undefined) return { kind: 'url', href }
  if (typeof value.label !== 'string') invalid('label')
  return { kind: 'url', href, label: value.label }
}

function parseEntry(raw: unknown): Entry {
  if (!isRecord(raw)) invalid('entries')
  return {
    id: requireNonEmpty(raw.id, 'id'),
    groupId: requireNonEmpty(raw.groupId, 'groupId'),
    version: requireVersion(raw.version),
    title: normalizeTitle(requireText(raw.title, 'title')),
    stylePrompt: requireText(raw.stylePrompt, 'stylePrompt'),
    lyrics: requireText(raw.lyrics, 'lyrics'),
    notes: requireText(raw.notes, 'notes'),
    tags: requireTags(raw.tags),
    rating: parseRating(raw),
    published: raw.published === undefined ? false : requireBoolean(raw.published, 'published'),
    publishLinks: raw.publishLinks === undefined ? [] : parsePublishLinks(raw.publishLinks),
    createdAt: requireIso(raw.createdAt, 'createdAt'),
    updatedAt: requireIso(raw.updatedAt, 'updatedAt'),
    audio: parseAudio(raw.audio),
    cover: null,
  }
}

export function parseExportBundle(raw: unknown): DeskExportBundle & { entries: Entry[] } {
  if (!isRecord(raw)) invalid('format')
  if (raw.format !== 'suno-prompt-desk') invalid('format')
  if (raw.formatVersion !== 1) invalid('formatVersion')
  if (typeof raw.exportedAt !== 'string' || Number.isNaN(Date.parse(raw.exportedAt))) {
    invalid('exportedAt')
  }
  if (!Array.isArray(raw.entries)) invalid('entries')

  return {
    format: 'suno-prompt-desk',
    formatVersion: 1,
    exportedAt: raw.exportedAt,
    entries: raw.entries.map(parseEntry),
  }
}
