import { randomUUID } from 'node:crypto'
import type { AudioRef, Entry, LibraryFacet, SortMode } from '../shared/types'
import { normalizeTitle } from '../shared/title'
import type { AppDatabase } from './db'

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
  created_at: number
  updated_at: number
  audio_json: string | null
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return []
  return tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)
}

function rowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    groupId: row.group_id,
    version: row.version,
    title: row.title,
    stylePrompt: row.style_prompt,
    lyrics: row.lyrics,
    notes: row.notes,
    tags: JSON.parse(row.tags_json) as string[],
    isPower: row.is_power === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    audio: row.audio_json ? (JSON.parse(row.audio_json) as AudioRef) : null,
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

function insertEntry(
  db: AppDatabase,
  fields: {
    groupId: string
    version: number
    title: string
    stylePrompt: string
    lyrics: string
    notes: string
    tags: string[]
    isPower: boolean
    audio: AudioRef | null
  },
): Entry {
  const id = randomUUID()
  const timestamp = Date.now()
  db.prepare(
    `INSERT INTO entries (
      id, group_id, version, title, style_prompt, lyrics, notes,
      tags_json, is_power, created_at, updated_at, audio_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    fields.groupId,
    fields.version,
    fields.title,
    fields.stylePrompt,
    fields.lyrics,
    fields.notes,
    JSON.stringify(fields.tags),
    fields.isPower ? 1 : 0,
    timestamp,
    timestamp,
    fields.audio ? JSON.stringify(fields.audio) : null,
  )
  return requireEntry(db, id)
}

export function createEntry(db: AppDatabase, input: CreateEntryInput): Entry {
  return insertEntry(db, {
    groupId: randomUUID(),
    version: 1,
    title: normalizeTitle(input.title ?? ''),
    stylePrompt: input.stylePrompt ?? '',
    lyrics: input.lyrics ?? '',
    notes: input.notes ?? '',
    tags: normalizeTags(input.tags),
    isPower: input.isPower ?? false,
    audio: input.audio ?? null,
  })
}

export function updateEntry(db: AppDatabase, id: string, patch: UpdateEntryPatch): Entry {
  const existing = requireEntry(db, id)
  const audio = patch.audio !== undefined ? patch.audio : existing.audio
  db.prepare(
    `UPDATE entries SET
      title = ?, style_prompt = ?, lyrics = ?, notes = ?, tags_json = ?,
      is_power = ?, updated_at = ?, audio_json = ?
    WHERE id = ?`,
  ).run(
    patch.title !== undefined ? normalizeTitle(patch.title) : existing.title,
    patch.stylePrompt !== undefined ? patch.stylePrompt : existing.stylePrompt,
    patch.lyrics !== undefined ? patch.lyrics : existing.lyrics,
    patch.notes !== undefined ? patch.notes : existing.notes,
    JSON.stringify(patch.tags !== undefined ? normalizeTags(patch.tags) : existing.tags),
    (patch.isPower !== undefined ? patch.isPower : existing.isPower) ? 1 : 0,
    Date.now(),
    audio ? JSON.stringify(audio) : null,
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
      `LOWER(title || ' ' || style_prompt || ' ' || lyrics || ' ' || notes || ' ' || tags_json) LIKE '%' || ? || '%'`,
    )
    params.push(search)
  }

  if (query.facet === 'power') {
    where.push('is_power = 1')
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
  title: string
  stylePrompt: string
  lyrics: string
  notes: string
  tags: string[]
  isPower: boolean
  audio: AudioRef | null
} {
  return {
    title: source.title,
    stylePrompt: source.stylePrompt,
    lyrics: source.lyrics,
    notes: source.notes,
    tags: source.tags,
    isPower: source.isPower,
    audio: source.audio,
  }
}

export function duplicateEntry(db: AppDatabase, id: string): Entry {
  const source = requireEntry(db, id)
  return insertEntry(db, {
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
  return insertEntry(db, {
    groupId: source.groupId,
    version: (row?.maxVersion ?? 0) + 1,
    ...copiedContent(source),
  })
}
