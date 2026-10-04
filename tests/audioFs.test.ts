import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  copyLocalAudio,
  deleteEntryAudio,
  localPlaybackUrl,
  parseLocalPlaybackUrl,
  resolveLocalAudioFile,
  sanitizeFilename,
} from '../src/main/audioFs'

describe('audioFs', () => {
  let userData: string

  afterEach(() => {
    if (userData) rmSync(userData, { recursive: true, force: true })
  })

  it('sanitizes unsafe filenames', () => {
    expect(sanitizeFilename('my song.mp3')).toBe('my song.mp3')
    expect(sanitizeFilename('../etc/passwd')).toBe('passwd')
    expect(sanitizeFilename('..')).toBe('audio')
    expect(sanitizeFilename('a:b?.mp3')).toBe('a_b_.mp3')
  })

  it('copies audio under userData/audio/<entryId> and replaces older files', () => {
    userData = mkdtempSync(join(tmpdir(), 'desk-audio-'))
    const source = join(userData, 'source.mp3')
    writeFileSync(source, 'audio-bytes')
    const entryId = 'entry-1'

    const copied = copyLocalAudio(userData, entryId, source)
    expect(copied).toEqual({ relativePath: 'source.mp3', originalName: 'source.mp3' })
    const stored = join(userData, 'audio', entryId, 'source.mp3')
    expect(readFileSync(stored, 'utf8')).toBe('audio-bytes')

    const next = join(userData, 'next.wav')
    writeFileSync(next, 'next')
    copyLocalAudio(userData, entryId, next)
    expect(readFileSync(join(userData, 'audio', entryId, 'next.wav'), 'utf8')).toBe('next')
    expect(() => readFileSync(stored)).toThrow()
  })

  it('deletes an entry audio directory and rejects path traversal', () => {
    userData = mkdtempSync(join(tmpdir(), 'desk-audio-'))
    const source = join(userData, 'track.mp3')
    writeFileSync(source, 'x')
    copyLocalAudio(userData, 'entry-1', source)
    deleteEntryAudio(userData, 'entry-1')
    expect(() => readFileSync(join(userData, 'audio', 'entry-1', 'track.mp3'))).toThrow()

    const audioRoot = join(userData, 'audio')
    expect(() => resolveLocalAudioFile(audioRoot, 'entry-1', '../track.mp3')).toThrow(/Invalid audio path/)
    expect(() => resolveLocalAudioFile(audioRoot, '../escape', 'track.mp3')).toThrow(/Invalid entry id/)
  })

  it('builds a desk playback url and parses encoded names', () => {
    const href = localPlaybackUrl('entry-1', 'my song.mp3')
    expect(href).toBe('desk://audio/entry-1/my%20song.mp3')
    expect(parseLocalPlaybackUrl(href)).toEqual({
      entryId: 'entry-1',
      relativePath: 'my song.mp3',
    })
    expect(parseLocalPlaybackUrl('file:///tmp/my%20song.mp3')).toBeNull()
    expect(parseLocalPlaybackUrl('desk://audio/entry-1/../secret.mp3')).toBeNull()
  })
})