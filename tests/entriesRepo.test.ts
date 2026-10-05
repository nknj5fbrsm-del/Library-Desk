import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openDatabase } from '../src/main/db'
import {
  createEntry,
  createVersion,
  deleteEntry,
  duplicateEntry,
  getEntry,
  listEntries,
  updateEntry,
} from '../src/main/entriesRepo'
import { getSetting, setSetting } from '../src/main/settingsRepo'

describe('entriesRepo', () => {
  let dir: string
  let db: ReturnType<typeof openDatabase>
  let now: number

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'desk-db-'))
    db = openDatabase(join(dir, 'library.db'))
    now = 1_700_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
  })

  afterEach(() => {
    db.close()
    vi.restoreAllMocks()
    rmSync(dir, { recursive: true, force: true })
  })

  it('create → get roundtrip; blank title becomes Ohne Titel', () => {
    const created = createEntry(db, {
      title: '   ',
      stylePrompt: 'dream pop',
      lyrics: 'la',
      notes: 'n',
      tags: ['  Night ', ''],
      rating: 5,
      audio: { kind: 'url', href: 'https://example.com/a.mp3', label: 'demo' },
    })

    expect(created.title).toBe('Ohne Titel')
    expect(created.version).toBe(1)
    expect(created.groupId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(created.id).not.toBe(created.groupId)
    expect(created.tags).toEqual(['Night'])
    expect(created.rating).toBe(5)
    expect(created.createdAt).toBe(now)
    expect(created.updatedAt).toBe(now)
    expect(created.audio).toEqual({
      kind: 'url',
      href: 'https://example.com/a.mp3',
      label: 'demo',
    })

    expect(getEntry(db, created.id)).toEqual(created)
    expect(getEntry(db, 'missing')).toBeNull()

    const defaults = createEntry(db, {})
    expect(defaults.title).toBe('Ohne Titel')
    expect(defaults.stylePrompt).toBe('')
    expect(defaults.lyrics).toBe('')
    expect(defaults.notes).toBe('')
    expect(defaults.tags).toEqual([])
    expect(defaults.rating).toBe(0)
    expect(defaults.audio).toBeNull()
    expect(defaults.version).toBe(1)
  })

  it('update changes fields and updatedAt, keeps identity timestamps', () => {
    const created = createEntry(db, { title: 'Alt', stylePrompt: 'old' })
    now = 1_700_000_111_000

    const updated = updateEntry(db, created.id, {
      title: '  Neu  ',
      stylePrompt: 'velvet',
      lyrics: 'words',
      notes: 'memo',
      tags: [' a ', 'b'],
      rating: 5,
      audio: { kind: 'local', relativePath: 'audio/x/f.mp3', originalName: 'f.mp3' },
    })

    expect(updated.title).toBe('Neu')
    expect(updated.stylePrompt).toBe('velvet')
    expect(updated.lyrics).toBe('words')
    expect(updated.notes).toBe('memo')
    expect(updated.tags).toEqual(['a', 'b'])
    expect(updated.rating).toBe(5)
    expect(updated.audio).toEqual({
      kind: 'local',
      relativePath: 'audio/x/f.mp3',
      originalName: 'f.mp3',
    })
    expect(updated.id).toBe(created.id)
    expect(updated.groupId).toBe(created.groupId)
    expect(updated.version).toBe(1)
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.updatedAt).toBe(now)
    expect(getEntry(db, created.id)).toEqual(updated)

    const cleared = updateEntry(db, created.id, { audio: null })
    expect(cleared.audio).toBeNull()
    expect(cleared.title).toBe('Neu')
    expect(cleared.stylePrompt).toBe('velvet')
    expect(() => updateEntry(db, 'missing', { title: 'x' })).toThrow(/not found/i)
  })

  it('lists by power, tag, and case-insensitive search', () => {
    const power = createEntry(db, {
      title: 'Power cut',
      stylePrompt: 'Velvet haze',
      tags: ['Night'],
      rating: 5,
    })
    const tagged = createEntry(db, {
      title: 'Plain',
      lyrics: 'chorus line',
      notes: 'studio note',
      tags: ['dream'],
    })
    createEntry(db, { title: 'Other', stylePrompt: 'rock' })

    const base = { search: '', facet: 'all' as const, sort: 'newest' as const }

    expect(listEntries(db, { ...base, facet: 'rated' }).map((e) => e.id)).toEqual([
      power.id,
    ])
    expect(
      listEntries(db, { ...base, facet: { tag: 'DREAM' } }).map((e) => e.id),
    ).toEqual([tagged.id])
    expect(
      listEntries(db, { ...base, search: 'VELVET' }).map((e) => e.id),
    ).toEqual([power.id])
    expect(listEntries(db, { ...base, search: 'chorus' }).map((e) => e.id)).toEqual([
      tagged.id,
    ])
    expect(listEntries(db, { ...base, search: 'studio' }).map((e) => e.id)).toEqual([
      tagged.id,
    ])
    expect(listEntries(db, { ...base, search: 'night' }).map((e) => e.id)).toEqual([
      power.id,
    ])
    expect(
      listEntries(db, { search: 'velvet', facet: 'rated', sort: 'newest' }).map(
        (e) => e.id,
      ),
    ).toEqual([power.id])
    expect(listEntries(db, { ...base, search: 'zzz' })).toEqual([])
  })

  it('sorts by title, newest, and updated', () => {
    now = 1000
    const first = createEntry(db, { title: 'coda' })
    now = 2000
    const second = createEntry(db, { title: 'Alpha' })
    now = 3000
    const third = createEntry(db, { title: 'beta' })

    const ids = (sort: 'title' | 'newest' | 'updated') =>
      listEntries(db, { search: '', facet: 'all', sort }).map((e) => e.id)

    expect(ids('title')).toEqual([second.id, third.id, first.id])
    expect(ids('newest')).toEqual([third.id, second.id, first.id])

    now = 4000
    updateEntry(db, first.id, { notes: 'touched' })
    expect(ids('updated')).toEqual([first.id, third.id, second.id])
    expect(ids('newest')).toEqual([third.id, second.id, first.id])
  })

  it('createVersion bumps version, keeps groupId, copies content', () => {
    const original = createEntry(db, {
      title: 'Song',
      stylePrompt: 'style',
      lyrics: 'ly',
      notes: 'no',
      tags: ['t'],
      rating: 5,
      audio: { kind: 'url', href: 'https://example.com/s.mp3' },
    })
    now = 9_000

    const next = createVersion(db, original.id)

    expect(next.id).not.toBe(original.id)
    expect(next.groupId).toBe(original.groupId)
    expect(next.version).toBe(2)
    expect(next.title).toBe(original.title)
    expect(next.stylePrompt).toBe(original.stylePrompt)
    expect(next.lyrics).toBe(original.lyrics)
    expect(next.notes).toBe(original.notes)
    expect(next.tags).toEqual(original.tags)
    expect(next.rating).toBe(5)
    expect(next.audio).toEqual(original.audio)
    expect(next.createdAt).toBe(now)
    expect(next.updatedAt).toBe(now)
    expect(getEntry(db, original.id)?.version).toBe(1)

    const third = createVersion(db, original.id)
    expect(third.version).toBe(3)
    expect(third.groupId).toBe(original.groupId)
  })

  it('duplicateEntry uses a new group and version 1', () => {
    const original = createEntry(db, {
      title: 'Song',
      stylePrompt: 'style',
      tags: ['t'],
      rating: 5,
    })
    now = 8_000

    const copy = duplicateEntry(db, original.id)

    expect(copy.id).not.toBe(original.id)
    expect(copy.groupId).not.toBe(original.groupId)
    expect(copy.version).toBe(1)
    expect(copy.title).toBe('Song')
    expect(copy.stylePrompt).toBe('style')
    expect(copy.tags).toEqual(['t'])
    expect(copy.rating).toBe(5)
    expect(copy.createdAt).toBe(now)
    expect(getEntry(db, original.id)?.groupId).toBe(original.groupId)
  })

  it('deleteEntry removes the row', () => {
    const created = createEntry(db, { title: 'Gone' })
    deleteEntry(db, created.id)
    expect(getEntry(db, created.id)).toBeNull()
    expect(listEntries(db, { search: '', facet: 'all', sort: 'newest' })).toEqual([])
  })

  it('persists published flag and publish links; filter published', () => {
    const live = createEntry(db, {
      title: 'Live',
      published: true,
      publishLinks: [
        { id: 'l1', label: 'YouTube', href: 'https://youtu.be/abc' },
        { id: 'l2', label: 'x', href: '  ' },
      ],
    })
    const draft = createEntry(db, { title: 'Draft' })
    expect(live.published).toBe(true)
    expect(live.publishLinks).toEqual([
      { id: 'l1', label: 'YouTube', href: 'https://youtu.be/abc' },
    ])
    expect(draft.published).toBe(false)
    expect(draft.publishLinks).toEqual([])

    const updated = updateEntry(db, live.id, { published: false })
    expect(updated.published).toBe(false)
    expect(updated.publishLinks).toEqual(live.publishLinks)

    const base = { search: '', facet: 'all' as const, sort: 'newest' as const }
    expect(listEntries(db, { ...base, facet: 'published' }).map((e) => e.id)).toEqual([])
    updateEntry(db, live.id, { published: true })
    expect(listEntries(db, { ...base, facet: 'published' }).map((e) => e.id)).toEqual([
      live.id,
    ])
  })

  it('copies published state on duplicate and version', () => {
    const original = createEntry(db, {
      title: 'Pub',
      published: true,
      publishLinks: [{ id: 'p1', label: 'SC', href: 'https://soundcloud.com/x' }],
    })
    const copy = duplicateEntry(db, original.id)
    expect(copy.published).toBe(true)
    expect(copy.publishLinks).toEqual(original.publishLinks)
    const version = createVersion(db, original.id)
    expect(version.published).toBe(true)
    expect(version.publishLinks).toEqual(original.publishLinks)
  })

  it('settings roundtrip and overwrite', () => {
    expect(getSetting(db, 'sort')).toBeNull()
    setSetting(db, 'sort', 'title')
    expect(getSetting(db, 'sort')).toBe('title')
    setSetting(db, 'sort', 'newest')
    expect(getSetting(db, 'sort')).toBe('newest')
  })

  it('reopen keeps rows after migrate', () => {
    const path = join(dir, 'library.db')
    const created = createEntry(db, { title: 'Persist' })
    db.close()
    const again = openDatabase(path)
    try {
      expect(getEntry(again, created.id)?.title).toBe('Persist')
    } finally {
      db = again
    }
  })
})
