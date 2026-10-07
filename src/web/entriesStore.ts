import type { CreateEntryInput, ListQuery, UpdateEntryPatch } from '../shared/deskApi'
import { filterAndSortEntries } from '../shared/listQuery'
import { normalizeTitle } from '../shared/title'
import type { AudioRef, CoverRef, Entry, PublishLink, StarRating } from '../shared/types'
import { normalizePublishLinks, normalizeRating } from '../shared/types'
import { idbReq, idbTxDone, STORE_ENTRIES } from './idb'

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return []
  return tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)
}

async function allEntries(db: IDBDatabase): Promise<Entry[]> {
  const tx = db.transaction(STORE_ENTRIES, 'readonly')
  return idbReq(tx.objectStore(STORE_ENTRIES).getAll() as IDBRequest<Entry[]>)
}

export async function getEntry(db: IDBDatabase, id: string): Promise<Entry | null> {
  const tx = db.transaction(STORE_ENTRIES, 'readonly')
  const row = await idbReq(tx.objectStore(STORE_ENTRIES).get(id) as IDBRequest<Entry | undefined>)
  return row ?? null
}

async function requireEntry(db: IDBDatabase, id: string): Promise<Entry> {
  const entry = await getEntry(db, id)
  if (!entry) throw new Error(`Entry not found: ${id}`)
  return entry
}

async function putEntry(db: IDBDatabase, entry: Entry): Promise<Entry> {
  const tx = db.transaction(STORE_ENTRIES, 'readwrite')
  const req = tx.objectStore(STORE_ENTRIES).put(entry)
  await Promise.all([idbReq(req), idbTxDone(tx)])
  return entry
}

function buildEntry(fields: {
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
  audio: AudioRef | null
  cover: CoverRef | null
}): Entry {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    groupId: fields.groupId,
    version: fields.version,
    title: fields.title,
    stylePrompt: fields.stylePrompt,
    lyrics: fields.lyrics,
    notes: fields.notes,
    tags: fields.tags,
    rating: fields.rating,
    published: fields.published,
    publishLinks: normalizePublishLinks(fields.publishLinks),
    createdAt: now,
    updatedAt: now,
    audio: fields.audio,
    cover: fields.cover,
  }
}

export async function createEntry(db: IDBDatabase, input: CreateEntryInput): Promise<Entry> {
  const entry = buildEntry({
    groupId: crypto.randomUUID(),
    version: 1,
    title: normalizeTitle(input.title ?? ''),
    stylePrompt: input.stylePrompt ?? '',
    lyrics: input.lyrics ?? '',
    notes: input.notes ?? '',
    tags: normalizeTags(input.tags),
    rating: normalizeRating(input.rating ?? 0),
    published: input.published === true,
    publishLinks: normalizePublishLinks(input.publishLinks),
    audio: input.audio ?? null,
    cover: input.cover ?? null,
  })
  return putEntry(db, entry)
}

export async function updateEntry(
  db: IDBDatabase,
  id: string,
  patch: UpdateEntryPatch,
): Promise<Entry> {
  const existing = await requireEntry(db, id)
  const rating =
    patch.rating !== undefined ? normalizeRating(patch.rating) : existing.rating
  const published =
    patch.published !== undefined ? patch.published === true : existing.published
  const next: Entry = {
    ...existing,
    title: patch.title !== undefined ? normalizeTitle(patch.title) : existing.title,
    stylePrompt: patch.stylePrompt !== undefined ? patch.stylePrompt : existing.stylePrompt,
    lyrics: patch.lyrics !== undefined ? patch.lyrics : existing.lyrics,
    notes: patch.notes !== undefined ? patch.notes : existing.notes,
    tags: patch.tags !== undefined ? normalizeTags(patch.tags) : existing.tags,
    rating,
    published,
    publishLinks:
      patch.publishLinks !== undefined
        ? normalizePublishLinks(patch.publishLinks)
        : existing.publishLinks,
    audio: patch.audio !== undefined ? patch.audio : existing.audio,
    cover: patch.cover !== undefined ? patch.cover : existing.cover,
    updatedAt: Date.now(),
  }
  return putEntry(db, next)
}

export async function deleteEntry(db: IDBDatabase, id: string): Promise<void> {
  const tx = db.transaction(STORE_ENTRIES, 'readwrite')
  const req = tx.objectStore(STORE_ENTRIES).delete(id)
  await Promise.all([idbReq(req), idbTxDone(tx)])
}

export async function listEntries(db: IDBDatabase, query: ListQuery): Promise<Entry[]> {
  const rows = await allEntries(db)
  return filterAndSortEntries(rows, query)
}

function copiedContent(source: Entry) {
  return {
    title: source.title,
    stylePrompt: source.stylePrompt,
    lyrics: source.lyrics,
    notes: source.notes,
    tags: [...source.tags],
    rating: source.rating,
    published: source.published,
    publishLinks: source.publishLinks.map((link) => ({ ...link })),
    audio: source.audio,
    cover: source.cover,
  }
}

export async function duplicateEntry(db: IDBDatabase, id: string): Promise<Entry> {
  const source = await requireEntry(db, id)
  const entry = buildEntry({
    groupId: crypto.randomUUID(),
    version: 1,
    ...copiedContent(source),
  })
  return putEntry(db, entry)
}

export async function createVersion(db: IDBDatabase, id: string): Promise<Entry> {
  const source = await requireEntry(db, id)
  const rows = await allEntries(db)
  const maxVersion = rows
    .filter((row) => row.groupId === source.groupId)
    .reduce((max, row) => Math.max(max, row.version), 0)
  const entry = buildEntry({
    groupId: source.groupId,
    version: maxVersion + 1,
    ...copiedContent(source),
  })
  return putEntry(db, entry)
}

/** Upsert full entry (import). Preserves ids/timestamps from caller. */
export async function putFullEntry(db: IDBDatabase, entry: Entry): Promise<'created' | 'updated'> {
  const existing = await getEntry(db, entry.id)
  await putEntry(db, {
    ...entry,
    publishLinks: normalizePublishLinks(entry.publishLinks),
    rating: normalizeRating(entry.rating),
    tags: normalizeTags(entry.tags),
    title: normalizeTitle(entry.title),
  })
  return existing ? 'updated' : 'created'
}
