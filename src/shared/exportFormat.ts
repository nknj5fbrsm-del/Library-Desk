import { normalizeEntryKind } from './entryKind'
import type {
  AudioRef,
  DeskExportBundle,
  Entry,
  EntryKind,
  PublishLink,
  StarRating,
} from './types'
import { normalizePublishLinks, normalizeRating } from './types'
import { normalizeTitle } from './title'

export type ExportAudioLocal =
  | { kind: 'local'; included: false; originalName: string }
  | { kind: 'local'; included: true; originalName: string; path: string }

export type ExportAudio = Extract<AudioRef, { kind: 'url' }> | ExportAudioLocal | null

export type ExportCover =
  | { included: false; originalName: string }
  | { included: true; originalName: string; path: string }

export interface ExportEntryRow {
  id: string
  groupId: string
  version: number
  kind: EntryKind
  title: string
  stylePrompt: string
  lyrics: string
  promptBody: string
  systemRole: string
  usageGuide: string
  notes: string
  tags: string[]
  rating: StarRating
  published: boolean
  publishLinks: PublishLink[]
  createdAt: string
  updatedAt: string
  audio: ExportAudio
  cover: ExportCover | null
}

export interface ExportMediaRef {
  path: string
  originalName: string
}

/** Entry plus optional zip-relative media paths (for SPD-Zip import). */
export interface ParsedExportEntry {
  entry: Entry
  audioFile: ExportMediaRef | null
  coverFile: ExportMediaRef | null
}

export interface EntryExportMediaPaths {
  audioPath?: string
  coverPath?: string
}

function invalid(detail: string): never {
  throw new Error(`Invalid suno-prompt-desk export: ${detail}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exportAudio(
  audio: AudioRef | null,
  audioPath: string | undefined,
): ExportAudio {
  if (!audio) return null
  if (audio.kind === 'local') {
    if (audioPath) {
      return {
        kind: 'local',
        included: true,
        originalName: audio.originalName,
        path: audioPath,
      }
    }
    return { kind: 'local', included: false, originalName: audio.originalName }
  }
  if (audio.label) return { kind: 'url', href: audio.href, label: audio.label }
  return { kind: 'url', href: audio.href }
}

export function entryToExportRow(
  entry: Entry,
  media: EntryExportMediaPaths = {},
): ExportEntryRow {
  let cover: ExportCover | null = null
  if (entry.cover) {
    if (media.coverPath) {
      cover = {
        included: true,
        originalName: entry.cover.originalName,
        path: media.coverPath,
      }
    } else {
      cover = { included: false, originalName: entry.cover.originalName }
    }
  }
  return {
    id: entry.id,
    groupId: entry.groupId,
    version: entry.version,
    kind: normalizeEntryKind(entry.kind),
    title: entry.title,
    stylePrompt: entry.stylePrompt,
    lyrics: entry.lyrics,
    promptBody: entry.promptBody ?? '',
    systemRole: entry.systemRole ?? '',
    usageGuide: entry.usageGuide ?? '',
    notes: entry.notes,
    tags: [...entry.tags],
    rating: entry.rating,
    published: entry.published,
    publishLinks: normalizePublishLinks(entry.publishLinks),
    createdAt: new Date(entry.createdAt).toISOString(),
    updatedAt: new Date(entry.updatedAt).toISOString(),
    audio: exportAudio(entry.audio, media.audioPath),
    cover,
  }
}

export function buildExportBundle(
  entries: Entry[],
  mediaById: Record<string, EntryExportMediaPaths> = {},
): string {
  const bundle: DeskExportBundle = {
    format: 'suno-prompt-desk',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    entries: entries.map((entry) => entryToExportRow(entry, mediaById[entry.id] ?? {})),
  }
  return JSON.stringify(bundle)
}

/** Safe download/default filename for a single-entry Desk zip export. */
export function entryExportFilename(entry: Entry): string {
  const base = entry.title
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim()
  const stem = base.length > 0 ? base : 'eintrag'
  return `${stem}.spd.zip`
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

function parseAudioField(value: unknown): {
  audio: AudioRef | null
  audioFile: ExportMediaRef | null
} {
  if (value === null || value === undefined) return { audio: null, audioFile: null }
  if (!isRecord(value)) invalid('audio')
  if (value.kind === 'local') {
    const originalName = requireText(value.originalName, 'originalName')
    if (value.included === true) {
      const path = requireNonEmpty(value.path, 'audio.path')
      return { audio: null, audioFile: { path, originalName } }
    }
    return { audio: null, audioFile: null }
  }
  if (value.kind !== 'url') invalid('audio')
  const href = requireNonEmpty(value.href, 'href')
  if (value.label === undefined) return { audio: { kind: 'url', href }, audioFile: null }
  if (typeof value.label !== 'string') invalid('label')
  return { audio: { kind: 'url', href, label: value.label }, audioFile: null }
}

function parseCoverField(value: unknown): {
  coverFile: ExportMediaRef | null
} {
  if (value === null || value === undefined) return { coverFile: null }
  if (!isRecord(value)) invalid('cover')
  const originalName = requireText(value.originalName, 'cover.originalName')
  if (value.included === true) {
    const path = requireNonEmpty(value.path, 'cover.path')
    return { coverFile: { path, originalName } }
  }
  return { coverFile: null }
}

function parseEntryDetailed(raw: unknown): ParsedExportEntry {
  if (!isRecord(raw)) invalid('entries')
  const { audio, audioFile } = parseAudioField(raw.audio)
  const { coverFile } = parseCoverField(raw.cover)
  const kind = normalizeEntryKind(raw.kind)
  return {
    entry: {
      id: requireNonEmpty(raw.id, 'id'),
      groupId: requireNonEmpty(raw.groupId, 'groupId'),
      version: requireVersion(raw.version),
      kind,
      title: normalizeTitle(requireText(raw.title, 'title')),
      stylePrompt: requireText(raw.stylePrompt, 'stylePrompt'),
      lyrics: requireText(raw.lyrics, 'lyrics'),
      promptBody:
        raw.promptBody === undefined ? '' : requireText(raw.promptBody, 'promptBody'),
      systemRole:
        raw.systemRole === undefined ? '' : requireText(raw.systemRole, 'systemRole'),
      usageGuide:
        raw.usageGuide === undefined ? '' : requireText(raw.usageGuide, 'usageGuide'),
      notes: requireText(raw.notes, 'notes'),
      tags: requireTags(raw.tags),
      rating: parseRating(raw),
      published: raw.published === undefined ? false : requireBoolean(raw.published, 'published'),
      publishLinks: raw.publishLinks === undefined ? [] : parsePublishLinks(raw.publishLinks),
      createdAt: requireIso(raw.createdAt, 'createdAt'),
      updatedAt: requireIso(raw.updatedAt, 'updatedAt'),
      audio,
      cover: null,
    },
    audioFile,
    coverFile,
  }
}

export function parseExportBundleDetailed(raw: unknown): {
  format: 'suno-prompt-desk'
  formatVersion: 1
  exportedAt: string
  entries: ParsedExportEntry[]
} {
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
    entries: raw.entries.map(parseEntryDetailed),
  }
}

/** JSON-only parse: local media becomes null on Entry (legacy). */
export function parseExportBundle(raw: unknown): DeskExportBundle & { entries: Entry[] } {
  const detailed = parseExportBundleDetailed(raw)
  return {
    format: detailed.format,
    formatVersion: detailed.formatVersion,
    exportedAt: detailed.exportedAt,
    entries: detailed.entries.map((item) => item.entry),
  }
}
