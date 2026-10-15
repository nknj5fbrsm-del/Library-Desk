import { describe, expect, it } from 'vitest'
import { collectEntriesForExport } from '../src/shared/exportGroup'
import type { Entry } from '../src/shared/types'

function entry(partial: Partial<Entry> & Pick<Entry, 'id' | 'groupId' | 'version'>): Entry {
  return {
    kind: 'suno',
    title: partial.title ?? partial.id,
    stylePrompt: '',
    lyrics: '',
    promptBody: '',
    systemRole: '',
    usageGuide: '',
    notes: '',
    tags: [],
    rating: 0,
    published: false,
    publishLinks: [],
    audio: null,
    cover: null,
    attachments: [],
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  }
}

describe('collectEntriesForExport', () => {
  const catalog = [
    entry({ id: 'a1', groupId: 'g1', version: 1, title: 'Song' }),
    entry({ id: 'a2', groupId: 'g1', version: 2, title: 'Song' }),
    entry({ id: 'b1', groupId: 'g2', version: 1, title: 'Other' }),
  ]

  it('includes all versions of the seed entry group', () => {
    expect(collectEntriesForExport(catalog, ['a1']).map((row) => row.id)).toEqual(['a1', 'a2'])
    expect(collectEntriesForExport(catalog, ['a2']).map((row) => row.id)).toEqual(['a1', 'a2'])
  })

  it('unions multiple groups for bulk export', () => {
    expect(collectEntriesForExport(catalog, ['a1', 'b1']).map((row) => row.id)).toEqual([
      'a1',
      'a2',
      'b1',
    ])
  })

  it('returns empty for unknown ids', () => {
    expect(collectEntriesForExport(catalog, ['missing'])).toEqual([])
  })
})
