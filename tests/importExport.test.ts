import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openDatabase } from '../src/main/db'
import { createEntry, deleteEntry, getEntry, listEntries } from '../src/main/entriesRepo'
import { importBundle } from '../src/main/importExport'
import { buildExportBundle, parseExportBundle } from '../src/shared/exportFormat'
import type { Entry } from '../src/shared/types'

const CREATED = Date.parse('2026-10-04T11:00:00.000Z')
const UPDATED = Date.parse('2026-10-04T11:30:00.000Z')

function bundleEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    groupId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    version: 3,
    kind: 'suno',
    title: 'Importiert',
    stylePrompt: 'velvet',
    lyrics: 'words',
    promptBody: '',
    systemRole: '',
    usageGuide: '',
    notes: 'note',
    tags: ['Night', 'Drive'],
    rating: 5,
    published: false,
    publishLinks: [],
    createdAt: CREATED,
    updatedAt: UPDATED,
    audio: { kind: 'url', href: 'https://example.com/track.mp3', label: 'demo' },
    cover: null,
    ...overrides,
  }
}

function bundleFrom(entries: Entry[]) {
  return parseExportBundle({
    format: 'suno-prompt-desk',
    formatVersion: 1,
    exportedAt: '2026-10-04T12:00:00.000Z',
    entries: entries.map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt).toISOString(),
      updatedAt: new Date(item.updatedAt).toISOString(),
      audio:
        item.audio?.kind === 'local'
          ? { kind: 'local', included: false, originalName: item.audio.originalName }
          : item.audio,
    })),
  })
}

describe('importBundle', () => {
  let dir: string
  let db: ReturnType<typeof openDatabase>
  let now: number

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'desk-import-'))
    db = openDatabase(join(dir, 'library.db'))
    now = 1_800_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    db.close()
    vi.restoreAllMocks()
    rmSync(dir, { recursive: true, force: true })
  })

  it('inserts new ids and keeps group, version, and epoch timestamps', () => {
    const incoming = bundleEntry()
    const result = importBundle(db, bundleFrom([incoming]))

    expect(result).toEqual({ created: 1, updated: 0, skipped: 0 })
    expect(getEntry(db, incoming.id)).toEqual(incoming)
  })

  it('stores url audio and drops local audio metadata', () => {
    const urlEntry = bundleEntry()
    const localEntry = bundleEntry({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      groupId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      version: 1,
      title: 'Lokal',
      audio: { kind: 'local', relativePath: 'audio/x/demo.mp3', originalName: 'demo.mp3' },
    })

    importBundle(db, bundleFrom([urlEntry, localEntry]))

    expect(getEntry(db, urlEntry.id)?.audio).toEqual(urlEntry.audio)
    expect(getEntry(db, localEntry.id)?.audio).toBeNull()
    expect(getEntry(db, localEntry.id)?.title).toBe('Lokal')
  })

  it('updates an existing id and inserts the other', () => {
    const existing = createEntry(db, { title: 'Alt', stylePrompt: 'old' })
    const replacement = bundleEntry({
      id: existing.id,
      title: 'Neu',
      stylePrompt: 'velvet',
      groupId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      version: 4,
      rating: 0,
      tags: ['Solo'],
      audio: null,
    })
    const fresh = bundleEntry({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      title: 'Frisch',
    })

    const result = importBundle(db, bundleFrom([replacement, fresh]))

    expect(result).toEqual({ created: 1, updated: 1, skipped: 0 })
    expect(getEntry(db, existing.id)).toEqual(replacement)
    expect(getEntry(db, fresh.id)?.title).toBe('Frisch')
    const rows = db.prepare('SELECT COUNT(*) AS n FROM entries').get() as { n: number }
    expect(rows.n).toBe(2)
  })

  it('drops local audio even when entry bypasses parseExportBundle', () => {
    const bypassed = bundleEntry({
      id: '99999999-9999-4999-8999-999999999999',
      title: 'Bypass',
      audio: {
        kind: 'local',
        relativePath: 'audio/evil/demo.mp3',
        originalName: 'demo.mp3',
      },
    })

    importBundle(db, { ...bundleFrom([bypassed]), entries: [bypassed] })

    expect(getEntry(db, bypassed.id)?.audio).toBeNull()
    expect(getEntry(db, bypassed.id)?.title).toBe('Bypass')
  })

  it('roundtrips export json: url audio stays, local audio is dropped', () => {
    const urlEntry = createEntry(db, {
      title: 'Stream',
      stylePrompt: 'velvet',
      lyrics: 'words',
      notes: 'note',
      tags: ['Night'],
      rating: 5,
      audio: { kind: 'url', href: 'https://example.com/track.mp3', label: 'demo' },
    })
    const localEntry = createEntry(db, {
      title: 'Lokal',
      stylePrompt: 'room',
      lyrics: 'local words',
      notes: 'file note',
      tags: ['Day'],
      audio: { kind: 'local', relativePath: 'audio/x/demo.mp3', originalName: 'demo.mp3' },
    })

    const filePath = join(dir, 'library.spd.json')
    writeFileSync(filePath, buildExportBundle(listEntries(db, { search: '', facet: 'all', kind: 'all', sort: 'title' })))
    deleteEntry(db, urlEntry.id)
    deleteEntry(db, localEntry.id)
    expect(listEntries(db, { search: '', facet: 'all', kind: 'all', sort: 'newest' })).toEqual([])

    const result = importBundle(db, parseExportBundle(JSON.parse(readFileSync(filePath, 'utf8'))))

    expect(result).toEqual({ created: 2, updated: 0, skipped: 0 })
    expect(getEntry(db, urlEntry.id)).toMatchObject({
      title: 'Stream',
      stylePrompt: 'velvet',
      lyrics: 'words',
      notes: 'note',
      tags: ['Night'],
      rating: 5,
      audio: { kind: 'url', href: 'https://example.com/track.mp3', label: 'demo' },
    })
    const restoredLocal = getEntry(db, localEntry.id)
    expect(restoredLocal?.audio).toBeNull()
    expect(restoredLocal).toMatchObject({
      title: 'Lokal',
      stylePrompt: 'room',
      lyrics: 'local words',
      notes: 'file note',
      tags: ['Day'],
    })
    expect(readFileSync(filePath, 'utf8')).not.toContain('audio/x/demo.mp3')
  })

  it('counts a second import of the same ids as updates', () => {
    const incoming = bundleEntry({ audio: null })
    expect(importBundle(db, bundleFrom([incoming]))).toEqual({ created: 1, updated: 0, skipped: 0 })
    expect(importBundle(db, bundleFrom([incoming]))).toEqual({ created: 0, updated: 1, skipped: 0 })
    expect(getEntry(db, incoming.id)?.createdAt).toBe(CREATED)
    expect(getEntry(db, incoming.id)?.updatedAt).toBe(UPDATED)
  })
})
