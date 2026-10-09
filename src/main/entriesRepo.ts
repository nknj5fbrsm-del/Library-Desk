import { randomUUID } from 'node:crypto'
import type { CreateEntryInput, ListQuery, UpdateEntryPatch } from '../shared/deskApi'
import { normalizeEntryKind } from '../shared/entryKind'
import type {
  AttachmentRef,
  AudioRef,
  CoverRef,
  Entry,
  EntryKind,
  PublishLink,
  StarRating,
} from '../shared/types'
import { normalizeAttachments, normalizePublishLinks, normalizeRating } from '../shared/types'
import { normalizeTitle } from '../shared/title'
import type { AppDatabase } from './db'

export type { CreateEntryInput, ListQuery, UpdateEntryPatch }

interface EntryRow {
  id: string
  group_id: string
  version: number
  title: string
  style_prompt: string
  lyrics: string
  notes: string
  tags_json: string
  is_power: number
  rating: number | null
  created_at: number
  updated_at: number
  audio_json: string | null
  cover_json: string | null
  published: number | null
  publish_links_json: string | null
  kind: string | null
  prompt_body: string | null
  system_role: string | null
  usage_guide: string | null
  attachments_json: string | null
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return []
  return tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)
}

function ratingFromRow(row: EntryRow): StarRating {
  if (row.rating != null) return normalizeRating(row.rating)
  return row.is_power === 1 ? 5 : 0
}

function publishLinksFromRow(row: EntryRow): PublishLink[] {
  if (!row.publish_links_json) return []
  try {
    return normalizePublishLinks(JSON.parse(row.publish_links_json) as PublishLink[])
  } catch {
    return []
  }
}

function attachmentsFromRow(row: EntryRow, kind: EntryKind): AttachmentRef[] {
  if (kind !== 'general' || !row.attachments_json) return []
  try {
    return normalizeAttachments(JSON.parse(row.attachments_json) as AttachmentRef[])
  } catch {
    return []
  }
}

function rowToEntry(row: EntryRow): Entry {
  const kind = normalizeEntryKind(row.kind)
  return {
    id: row.id,
    groupId: row.group_id,
    version: row.version,
    kind,
    title: row.title,
    stylePrompt: row.style_prompt,
    lyrics: row.lyrics,
    promptBody: row.prompt_body ?? '',
    systemRole: row.system_role ?? '',
    usageGuide: row.usage_guide ?? '',
    notes: row.notes,
    tags: JSON.parse(row.tags_json) as string[],
    rating: ratingFromRow(row),
    published: row.published === 1,
    publishLinks: publishLinksFromRow(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    audio: row.audio_json ? (JSON.parse(row.audio_json) as AudioRef) : null,
    cover: row.cover_json ? (JSON.parse(row.cover_json) as CoverRef) : null,
    attachments: attachmentsFromRow(row, kind),
  }
}

function requireEntry(db: AppDatabase, id: string): Entry {
  const entry = getEntry(db, id)
  if (!entry) throw new Error(`Entry not found: ${id}`)
  return entry
}

export function getEntry(db: AppDatabase, id: string): Entry | null {
  const row = db
    .prepare<[string], EntryRow>('SELECT * FROM entries WHERE id = ?')
    .get(id)
  return row ? rowToEntry(row) : null
}

function insertGenerated(
  db: AppDatabase,
  fields: {
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
    audio: AudioRef | null
    cover: CoverRef | null
    attachments: AttachmentRef[]
  },
): Entry {
  const id = randomUUID()
  const timestamp = Date.now()
  const publishLinks = normalizePublishLinks(fields.publishLinks)
  const attachments =
    fields.kind === 'general' ? normalizeAttachments(fields.attachments) : []
  db.prepare(
    `INSERT INTO entries (
      id, group_id, version, title, style_prompt, lyrics, notes,
      tags_json, is_power, rating, created_at, updated_at, audio_json, cover_json,
      published, publish_links_json, kind, prompt_body, system_role, usage_guide,
      attachments_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    fields.groupId,
    fields.version,
    fields.title,
    fields.stylePrompt,
    fields.lyrics,
    fields.notes,
    JSON.stringify(fields.tags),
    fields.rating > 0 ? 1 : 0,
    fields.rating,
    timestamp,
    timestamp,
    fields.audio ? JSON.stringify(fields.audio) : null,
    fields.cover ? JSON.stringify(fields.cover) : null,
    fields.published ? 1 : 0,
    JSON.stringify(publishLinks),
    fields.kind,
    fields.promptBody,
    fields.systemRole,
    fields.usageGuide,
    JSON.stringify(attachments),
  )
  return requireEntry(db, id)
}

export function upsertFullEntry(db: AppDatabase, entry: Entry): 'created' | 'updated' {
  const publishLinks = normalizePublishLinks(entry.publishLinks)
  const kind = normalizeEntryKind(entry.kind)
  const attachments = kind === 'general' ? normalizeAttachments(entry.attachments) : []
  const existing = getEntry(db, entry.id)
  if (existing) {
    db.prepare(
      `UPDATE entries SET
        group_id = ?, version = ?, title = ?, style_prompt = ?, lyrics = ?, notes = ?,
        tags_json = ?, is_power = ?, rating = ?, created_at = ?, updated_at = ?, audio_json = ?, cover_json = ?,
        published = ?, publish_links_json = ?, kind = ?, prompt_body = ?, system_role = ?, usage_guide = ?,
        attachments_json = ?
      WHERE id = ?`,
    ).run(
      entry.groupId,
      entry.version,
      entry.title,
      entry.stylePrompt,
      entry.lyrics,
      entry.notes,
      JSON.stringify(entry.tags),
      entry.rating > 0 ? 1 : 0,
      entry.rating,
      entry.createdAt,
      entry.updatedAt,
      entry.audio ? JSON.stringify(entry.audio) : null,
      entry.cover ? JSON.stringify(entry.cover) : null,
      entry.published ? 1 : 0,
      JSON.stringify(publishLinks),
      kind,
      entry.promptBody ?? '',
      entry.systemRole ?? '',
      entry.usageGuide ?? '',
      JSON.stringify(attachments),
      entry.id,
    )
    return 'updated'
  }

  db.prepare(
    `INSERT INTO entries (
      id, group_id, version, title, style_prompt, lyrics, notes,
      tags_json, is_power, rating, created_at, updated_at, audio_json, cover_json,
      published, publish_links_json, kind, prompt_body, system_role, usage_guide,
      attachments_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.id,
    entry.groupId,
    entry.version,
    entry.title,
    entry.stylePrompt,
    entry.lyrics,
    entry.notes,
    JSON.stringify(entry.tags),
    entry.rating > 0 ? 1 : 0,
    entry.rating,
    entry.createdAt,
    entry.updatedAt,
    entry.audio ? JSON.stringify(entry.audio) : null,
    entry.cover ? JSON.stringify(entry.cover) : null,
    entry.published ? 1 : 0,
    JSON.stringify(publishLinks),
    kind,
    entry.promptBody ?? '',
    entry.systemRole ?? '',
    entry.usageGuide ?? '',
    JSON.stringify(attachments),
  )
  return 'created'
}

export function createEntry(db: AppDatabase, input: CreateEntryInput): Entry {
  const kind = normalizeEntryKind(input.kind)
  return insertGenerated(db, {
    groupId: randomUUID(),
    version: 1,
    kind,
    title: normalizeTitle(input.title ?? ''),
    stylePrompt: input.stylePrompt ?? '',
    lyrics: input.lyrics ?? '',
    promptBody: input.promptBody ?? '',
    systemRole: input.systemRole ?? '',
    usageGuide: input.usageGuide ?? '',
    notes: input.notes ?? '',
    tags: normalizeTags(input.tags),
    rating: normalizeRating(input.rating ?? 0),
    published: kind === 'suno' && input.published === true,
    publishLinks: kind === 'suno' ? normalizePublishLinks(input.publishLinks) : [],
    audio: kind === 'suno' ? (input.audio ?? null) : null,
    cover: kind === 'suno' ? (input.cover ?? null) : null,
    attachments: kind === 'general' ? normalizeAttachments(input.attachments) : [],
  })
}

export function updateEntry(db: AppDatabase, id: string, patch: UpdateEntryPatch): Entry {
  const existing = requireEntry(db, id)
  const kind = existing.kind
  const audio =
    kind === 'suno' ? (patch.audio !== undefined ? patch.audio : existing.audio) : null
  const cover =
    kind === 'suno' ? (patch.cover !== undefined ? patch.cover : existing.cover) : null
  const attachments =
    kind === 'general'
      ? patch.attachments !== undefined
        ? normalizeAttachments(patch.attachments)
        : existing.attachments
      : []
  const rating =
    patch.rating !== undefined ? normalizeRating(patch.rating) : existing.rating
  const published =
    kind === 'suno'
      ? patch.published !== undefined
        ? patch.published === true
        : existing.published
      : false
  const publishLinks =
    kind === 'suno'
      ? patch.publishLinks !== undefined
        ? normalizePublishLinks(patch.publishLinks)
        : existing.publishLinks
      : []
  db.prepare(
    `UPDATE entries SET
      title = ?, style_prompt = ?, lyrics = ?, notes = ?, tags_json = ?,
      is_power = ?, rating = ?, updated_at = ?, audio_json = ?, cover_json = ?,
      published = ?, publish_links_json = ?, prompt_body = ?, system_role = ?, usage_guide = ?,
      attachments_json = ?
    WHERE id = ?`,
  ).run(
    patch.title !== undefined ? normalizeTitle(patch.title) : existing.title,
    patch.stylePrompt !== undefined ? patch.stylePrompt : existing.stylePrompt,
    patch.lyrics !== undefined ? patch.lyrics : existing.lyrics,
    patch.notes !== undefined ? patch.notes : existing.notes,
    JSON.stringify(patch.tags !== undefined ? normalizeTags(patch.tags) : existing.tags),
    rating > 0 ? 1 : 0,
    rating,
    Date.now(),
    audio ? JSON.stringify(audio) : null,
    cover ? JSON.stringify(cover) : null,
    published ? 1 : 0,
    JSON.stringify(publishLinks),
    patch.promptBody !== undefined ? patch.promptBody : existing.promptBody,
    patch.systemRole !== undefined ? patch.systemRole : existing.systemRole,
    patch.usageGuide !== undefined ? patch.usageGuide : existing.usageGuide,
    JSON.stringify(attachments),
    id,
  )
  return requireEntry(db, id)
}

export function deleteEntry(db: AppDatabase, id: string): void {
  db.prepare('DELETE FROM entries WHERE id = ?').run(id)
}

export function listEntries(db: AppDatabase, query: ListQuery): Entry[] {
  const where: string[] = []
  const params: unknown[] = []
  const search = query.search.trim().toLowerCase()

  if (search.length > 0) {
    where.push(
      `LOWER(title || ' ' || style_prompt || ' ' || lyrics || ' ' || notes || ' ' || tags_json || ' ' || COALESCE(prompt_body, '') || ' ' || COALESCE(system_role, '') || ' ' || COALESCE(usage_guide, '')) LIKE '%' || ? || '%'`,
    )
    params.push(search)
  }

  if (query.kind === 'suno' || query.kind === 'general') {
    where.push(`COALESCE(kind, 'suno') = ?`)
    params.push(query.kind)
  }

  if (query.facet === 'rated') {
    where.push('rating >= 1')
  } else if (query.facet === 'published') {
    where.push('published = 1')
  } else if (typeof query.facet === 'object') {
    where.push(
      `EXISTS (SELECT 1 FROM json_each(tags_json) WHERE LOWER(value) = LOWER(?))`,
    )
    params.push(query.facet.tag.trim())
  }

  const orderBy =
    query.sort === 'title'
      ? 'title COLLATE NOCASE ASC, id ASC'
      : query.sort === 'updated'
        ? 'updated_at DESC, id ASC'
        : 'created_at DESC, id ASC'

  const sql = `SELECT * FROM entries${where.length > 0 ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY ${orderBy}`
  const rows = db.prepare<unknown[], EntryRow>(sql).all(...params)
  return rows.map(rowToEntry)
}

function copiedContent(source: Entry): {
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
  audio: AudioRef | null
  cover: CoverRef | null
  attachments: AttachmentRef[]
} {
  return {
    kind: source.kind,
    title: source.title,
    stylePrompt: source.stylePrompt,
    lyrics: source.lyrics,
    promptBody: source.promptBody,
    systemRole: source.systemRole,
    usageGuide: source.usageGuide,
    notes: source.notes,
    tags: source.tags,
    rating: source.rating,
    published: source.published,
    publishLinks: source.publishLinks.map((link) => ({ ...link })),
    audio: source.audio,
    cover: source.cover,
    attachments: source.attachments.map((item) => ({ ...item })),
  }
}

export function duplicateEntry(db: AppDatabase, id: string): Entry {
  const source = requireEntry(db, id)
  return insertGenerated(db, {
    groupId: randomUUID(),
    version: 1,
    ...copiedContent(source),
  })
}

export function createVersion(db: AppDatabase, id: string): Entry {
  const source = requireEntry(db, id)
  const row = db
    .prepare<[string], { maxVersion: number }>(
      'SELECT COALESCE(MAX(version), 0) AS maxVersion FROM entries WHERE group_id = ?',
    )
    .get(source.groupId)
  return insertGenerated(db, {
    groupId: source.groupId,
    version: (row?.maxVersion ?? 0) + 1,
    ...copiedContent(source),
  })
}
