import { describe, expect, it } from 'vitest'
import { buildExportBundle, parseExportBundleDetailed } from '../src/shared/exportFormat'
import { mediaZipPath, packSpdZip, unpackSpdZip } from '../src/shared/spdZip'
import type { Entry } from '../src/shared/types'

function entry(partial: Partial<Entry> = {}): Entry {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    groupId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    version: 1,
    kind: 'suno',
    title: 'Song',
    stylePrompt: 'pop',
    lyrics: 'la',
    promptBody: '',
    systemRole: '',
    usageGuide: '',
    notes: '',
    tags: [],
    rating: 0,
    published: false,
    publishLinks: [],
    createdAt: 1,
    updatedAt: 2,
    audio: { kind: 'local', relativePath: 'demo.m4a', originalName: 'demo.m4a' },
    cover: { relativePath: 'cover.png', originalName: 'cover.png' },
    attachments: [],
    ...partial,
  }
}

describe('spd zip', () => {
  it('roundtrips library.json and media files', async () => {
    const song = entry()
    const audioPath = mediaZipPath(song.id, 'demo.m4a')
    const coverPath = mediaZipPath(song.id, 'cover.png')
    const json = buildExportBundle([song], {
      [song.id]: { audioPath, coverPath },
    })
    const zip = await packSpdZip(json, [
      { path: audioPath, data: new Uint8Array([1, 2, 3]) },
      { path: coverPath, data: new Uint8Array([4, 5]) },
    ])
    const unpacked = await unpackSpdZip(zip)
    const detailed = parseExportBundleDetailed(JSON.parse(unpacked.libraryJson) as unknown)
    expect(detailed.entries).toHaveLength(1)
    expect(detailed.entries[0]?.audioFile?.path).toBe(audioPath)
    expect(detailed.entries[0]?.coverFile?.path).toBe(coverPath)
    expect(Array.from(unpacked.files.get(audioPath) ?? [])).toEqual([1, 2, 3])
    expect(Array.from(unpacked.files.get(coverPath) ?? [])).toEqual([4, 5])
  })
})
