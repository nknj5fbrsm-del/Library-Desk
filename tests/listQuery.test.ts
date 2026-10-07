import { describe, expect, it } from 'vitest'
import type { ListQuery } from '../src/shared/deskApi'
import { filterAndSortEntries } from '../src/shared/listQuery'
import type { Entry } from '../src/shared/types'

function e(partial: Partial<Entry> & Pick<Entry, 'id' | 'title'>): Entry {
  return {
    groupId: 'g',
    version: 1,
    stylePrompt: '',
    lyrics: '',
    notes: '',
    tags: [],
    rating: 0,
    published: false,
    publishLinks: [],
    createdAt: 1,
    updatedAt: 1,
    audio: null,
    cover: null,
    ...partial,
  }
}

describe('filterAndSortEntries', () => {
  it('filters by search and facet published', () => {
    const rows = [
      e({ id: '1', title: 'Alpha', published: true, stylePrompt: 'rock' }),
      e({ id: '2', title: 'Beta', published: false }),
    ]
    const q: ListQuery = { search: 'alp', facet: 'published', sort: 'title' }
    expect(filterAndSortEntries(rows, q).map((x) => x.id)).toEqual(['1'])
  })

  it('filters rated and sorts by title', () => {
    const rows = [
      e({ id: '2', title: 'Beta', rating: 3 }),
      e({ id: '1', title: 'Alpha', rating: 5 }),
      e({ id: '3', title: 'Gamma', rating: 0 }),
    ]
    const q: ListQuery = { search: '', facet: 'rated', sort: 'title' }
    expect(filterAndSortEntries(rows, q).map((x) => x.id)).toEqual(['1', '2'])
  })

  it('filters by tag facet', () => {
    const rows = [
      e({ id: '1', title: 'A', tags: ['Pop'] }),
      e({ id: '2', title: 'B', tags: ['rock'] }),
    ]
    const q: ListQuery = { search: '', facet: { tag: 'pop' }, sort: 'title' }
    expect(filterAndSortEntries(rows, q).map((x) => x.id)).toEqual(['1'])
  })
})
