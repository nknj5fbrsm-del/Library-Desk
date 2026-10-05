import { describe, expect, it, vi, afterEach } from 'vitest'
import type { Entry } from '../src/shared/types'
import {
  buildExportBundle,
  entryToExportRow,
  parseExportBundle,
} from '../src/shared/exportFormat'

const CREATED = Date.parse('2026-10-04T11:00:00.000Z')
const UPDATED = Date.parse('2026-10-04T11:30:00.000Z')

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    groupId: '22222222-2222-4222-8222-222222222222',
    version: 2,
    title: 'Beispiel',
    stylePrompt: 'dream pop',
    lyrics: '[Verse]\nla',
    notes: 'memo',
    tags: ['Night'],
    rating: 5,
    createdAt: CREATED,
    updatedAt: UPDATED,
    audio: null,
    cover: null,
    ...overrides,
  }
}

describe('export format', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('serializes url audio fully and timestamps as ISO-8601', () => {
    const row = entryToExportRow(
      entry({
        audio: { kind: 'url', href: 'https://example.com/track.mp3', label: 'demo' },
      }),
    )

    expect(row).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      groupId: '22222222-2222-4222-8222-222222222222',
      version: 2,
      title: 'Beispiel',
      stylePrompt: 'dream pop',
      lyrics: '[Verse]\nla',
      notes: 'memo',
      tags: ['Night'],
      rating: 5,
      createdAt: '2026-10-04T11:00:00.000Z',
      updatedAt: '2026-10-04T11:30:00.000Z',
      audio: { kind: 'url', href: 'https://example.com/track.mp3', label: 'demo' },
      cover: null,
    })
  })

  it('omits an empty url label', () => {
    const row = entryToExportRow(
      entry({ audio: { kind: 'url', href: 'https://example.com/a.mp3' } }),
    )
    expect(row).toMatchObject({
      audio: { kind: 'url', href: 'https://example.com/a.mp3' },
    })
    expect(row).not.toHaveProperty('audio.label')
  })

  it('strips local audio to metadata without a path or binary', () => {
    const row = entryToExportRow(
      entry({
        audio: {
          kind: 'local',
          relativePath: 'audio/abc/demo.mp3',
          originalName: 'demo.mp3',
        },
      }),
    )

    expect(row).toMatchObject({
      audio: { kind: 'local', included: false, originalName: 'demo.mp3' },
    })
    expect(JSON.stringify(row)).not.toContain('relativePath')
    expect(JSON.stringify(row)).not.toContain('audio/abc/demo.mp3')
  })

  it('serializes missing audio as null', () => {
    expect(entryToExportRow(entry()).audio).toBeNull()
  })

  it('wraps entries in a suno-prompt-desk v1 bundle', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-04T12:00:00.000Z'))

    const json = buildExportBundle([
      entry({ audio: { kind: 'url', href: 'https://example.com/track.mp3', label: 'demo' } }),
    ])
    const bundle = JSON.parse(json) as {
      format: string
      formatVersion: number
      exportedAt: string
      entries: unknown[]
    }

    expect(bundle.format).toBe('suno-prompt-desk')
    expect(bundle.formatVersion).toBe(1)
    expect(bundle.exportedAt).toBe('2026-10-04T12:00:00.000Z')
    expect(bundle.entries).toHaveLength(1)
    expect(bundle.entries[0]).toMatchObject({
      title: 'Beispiel',
      createdAt: '2026-10-04T11:00:00.000Z',
    })
  })

  it('parses a bundle back to entries with epoch-ms timestamps', () => {
    const raw = {
      format: 'suno-prompt-desk',
      formatVersion: 1,
      exportedAt: '2026-10-04T12:00:00.000Z',
      entries: [
        entryToExportRow(
          entry({
            audio: { kind: 'url', href: 'https://example.com/track.mp3', label: 'demo' },
          }),
        ),
      ],
    }

    const parsed = parseExportBundle(raw)
    expect(parsed.format).toBe('suno-prompt-desk')
    expect(parsed.formatVersion).toBe(1)
    expect(parsed.exportedAt).toBe('2026-10-04T12:00:00.000Z')
    expect(parsed.entries).toEqual([
      entry({
        audio: { kind: 'url', href: 'https://example.com/track.mp3', label: 'demo' },
      }),
    ])
  })

  it('maps imported local audio metadata to audio null', () => {
    const parsed = parseExportBundle({
      format: 'suno-prompt-desk',
      formatVersion: 1,
      exportedAt: '2026-10-04T12:00:00.000Z',
      entries: [
        {
          ...entryToExportRow(entry()),
          audio: { kind: 'local', included: false, originalName: 'demo.mp3' },
        },
      ],
    })

    expect(parsed.entries[0]?.audio).toBeNull()
    expect(parsed.entries[0]?.title).toBe('Beispiel')
    expect(parsed.entries[0]?.createdAt).toBe(CREATED)
  })

  it('normalizes empty and whitespace-only titles to Ohne Titel on import', () => {
    const base = {
      format: 'suno-prompt-desk' as const,
      formatVersion: 1 as const,
      exportedAt: '2026-10-04T12:00:00.000Z',
    }
    const row = entryToExportRow(entry())

    const emptyTitle = parseExportBundle({
      ...base,
      entries: [{ ...row, title: '' }],
    })
    expect(emptyTitle.entries[0]?.title).toBe('Ohne Titel')

    const whitespaceTitle = parseExportBundle({
      ...base,
      entries: [{ ...row, title: '   \t  ' }],
    })
    expect(whitespaceTitle.entries[0]?.title).toBe('Ohne Titel')
  })

  it('roundtrips empty style, lyrics, and notes', () => {
    const source = entry({
      stylePrompt: '',
      lyrics: '',
      notes: '',
      rating: 0,
      tags: [],
    })
    const parsed = parseExportBundle({
      format: 'suno-prompt-desk',
      formatVersion: 1,
      exportedAt: '2026-10-04T12:00:00.000Z',
      entries: [entryToExportRow(source)],
    })
    expect(parsed.entries).toEqual([source])
  })

  it('rejects a bundle that is not suno-prompt-desk v1', () => {
    const base = {
      format: 'suno-prompt-desk',
      formatVersion: 1,
      exportedAt: '2026-10-04T12:00:00.000Z',
      entries: [],
    }

    expect(() => parseExportBundle(null)).toThrow(/format/i)
    expect(() => parseExportBundle({ ...base, format: 'other' })).toThrow(/format/i)
    expect(() => parseExportBundle({ ...base, formatVersion: 2 })).toThrow(/formatVersion/i)
    expect(() => parseExportBundle({ ...base, entries: {} })).toThrow(/entries/i)
    expect(() =>
      parseExportBundle({
        ...base,
        entries: [{ title: 'nur titel' }],
      }),
    ).toThrow(/id/i)
  })
})
