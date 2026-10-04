import type { AudioRef, DeskExportBundle, Entry } from './types'

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
  isPower: boolean
  createdAt: string
  updatedAt: string
  audio: ExportAudio
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
    isPower: entry.isPower,
    createdAt: new Date(entry.createdAt).toISOString(),
    updatedAt: new Date(entry.updatedAt).toISOString(),
    audio: exportAudio(entry.audio),
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
    title: requireText(raw.title, 'title'),
    stylePrompt: requireText(raw.stylePrompt, 'stylePrompt'),
    lyrics: requireText(raw.lyrics, 'lyrics'),
    notes: requireText(raw.notes, 'notes'),
    tags: requireTags(raw.tags),
    isPower: requireBoolean(raw.isPower, 'isPower'),
    createdAt: requireIso(raw.createdAt, 'createdAt'),
    updatedAt: requireIso(raw.updatedAt, 'updatedAt'),
    audio: parseAudio(raw.audio),
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
