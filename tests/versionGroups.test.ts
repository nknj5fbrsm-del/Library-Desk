import { describe, it, expect } from 'vitest'
import type { Entry } from '../src/shared/types'
import { groupEntriesForDisplay } from '../src/shared/versionGroups'

function entry(
  partial: Pick<Entry, 'id' | 'groupId' | 'version'> & Partial<Entry>,
): Entry {
  return {
    title: 'T',
    kind: 'suno',
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
    createdAt: 0,
    updatedAt: 0,
    audio: null,
    cover: null,
    ...partial,
  }
}

describe('groupEntriesForDisplay', () => {
  it('merges same groupId into one group with badge-relevant length', () => {
    const g = 'group-a'
    const entries = [
      entry({ id: '1', groupId: g, version: 1 }),
      entry({ id: '2', groupId: g, version: 2 }),
    ]
    const groups = groupEntriesForDisplay(entries)
    expect(groups).toHaveLength(1)
    expect(groups[0].versions).toHaveLength(2)
    expect(groups[0].versions.length >= 2).toBe(true)
  })

  it('solo entry is one group with one version', () => {
    const entries = [entry({ id: 'solo', groupId: 'g-solo', version: 1 })]
    const groups = groupEntriesForDisplay(entries)
    expect(groups).toHaveLength(1)
    expect(groups[0].versions).toHaveLength(1)
  })

  it('representative is highest version', () => {
    const g = 'group-b'
    const v2 = entry({ id: '2', groupId: g, version: 2, title: 'V2' })
    const v1 = entry({ id: '1', groupId: g, version: 1, title: 'V1' })
    const groups = groupEntriesForDisplay([v1, v2])
    expect(groups[0].representative.id).toBe('2')
    expect(groups[0].versions.map((e) => e.version)).toEqual([1, 2])
  })

  it('group order follows first sighting in input', () => {
    const entries = [
      entry({ id: 'a1', groupId: 'ga', version: 1 }),
      entry({ id: 'b1', groupId: 'gb', version: 1 }),
      entry({ id: 'a2', groupId: 'ga', version: 2 }),
    ]
    const groups = groupEntriesForDisplay(entries)
    expect(groups.map((g) => g.key)).toEqual(['ga', 'gb'])
  })
})
