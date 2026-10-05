import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from '../src/main/db'
import { getEntry } from '../src/main/entriesRepo'
import { importLibraryJson } from '../src/main/importExport'
import { mapMastermindItem } from '../src/shared/mastermindImport'

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('mapMastermindItem', () => {
  it('maps core fields and filters empty content', () => {
    const mapped = mapMastermindItem({
      id: 'song-1',
      timestamp: 1_700_000_000_000,
      lastSavedAt: 1_700_000_100_000,
      isFavorite: true,
      libraryTitle: 'Nachtzug',
      versionGroupId: 'grp-1',
      version: 2,
      lyrics: 'Verse',
      notes: 'Notiz',
      concept: { topic: 'Topic', genre: ['Pop', 'Pop'], mood: ['Dark'] },
      styleData: { prompt: 'dream pop', titleSuggestions: ['Alt'] },
      coverUrl: TINY_PNG,
    })
    expect(mapped.entry).toMatchObject({
      id: 'song-1',
      groupId: 'grp-1',
      version: 2,
      title: 'Nachtzug',
      stylePrompt: 'dream pop',
      lyrics: 'Verse',
      notes: 'Notiz',
      tags: ['Pop', 'Dark'],
      rating: 5,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_100_000,
    })
    expect(mapped.coverDataUrl).toBe(TINY_PNG)
    expect(mapMastermindItem({ id: 'x', lyrics: '', styleData: { prompt: '' } }).skipReason).toBe(
      'weder Style noch Lyrics',
    )
    expect(mapMastermindItem({ lyrics: 'a' }).skipReason).toBe('keine id')
  })
})

describe('importLibraryJson mastermind', () => {
  let dir: string
  let db: ReturnType<typeof openDatabase>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'desk-mm-'))
    db = openDatabase(join(dir, 'library.db'))
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('imports usable items, skips junk, stores cover file', () => {
    const result = importLibraryJson(db, dir, [
      {
        id: 'ok-1',
        timestamp: 10,
        libraryTitle: 'Ok',
        lyrics: 'hi',
        styleData: { prompt: 'style' },
        concept: { genre: ['Rock'], mood: [] },
        coverUrl: TINY_PNG,
      },
      { id: 'skip-empty', lyrics: '', styleData: { prompt: '  ' } },
      { lyrics: 'no-id', styleData: { prompt: 'x' } },
    ])

    expect(result).toEqual({ created: 1, updated: 0, skipped: 2 })
    const entry = getEntry(db, 'ok-1')
    expect(entry?.title).toBe('Ok')
    expect(entry?.cover?.relativePath).toBe('cover.png')
  })
})
