import { copyFileSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'

const ENTRY_ID = /^[A-Za-z0-9._-]{1,128}$/

export function audioRootFor(userData: string): string {
  return join(userData, 'audio')
}

export function assertEntryId(entryId: string): string {
  if (!ENTRY_ID.test(entryId)) throw new Error('Invalid entry id')
  return entryId
}

export function sanitizeFilename(name: string): string {
  const base = basename(name)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/^\.+/, '')
    .trim()
  const clipped = base.slice(0, 180)
  if (!clipped || clipped === '.' || clipped === '..') return 'audio'
  return clipped
}

function entryDir(audioRoot: string, entryId: string): string {
  return join(audioRoot, assertEntryId(entryId))
}

export function copyLocalAudio(
  userData: string,
  entryId: string,
  sourcePath: string,
): { relativePath: string; originalName: string } {
  const originalName = basename(sourcePath)
  const relativePath = sanitizeFilename(originalName)
  const audioRoot = audioRootFor(userData)
  const dir = entryDir(audioRoot, entryId)
  const staging = join(userData, `.audio-staging-${assertEntryId(entryId)}`)
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  try {
    copyFileSync(sourcePath, join(staging, relativePath))
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(audioRoot, { recursive: true })
    renameSync(staging, dir)
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    throw error
  }
  return { relativePath, originalName }
}

export function deleteEntryAudio(userData: string, entryId: string): void {
  rmSync(entryDir(audioRootFor(userData), entryId), { recursive: true, force: true })
}

export function localPlaybackUrl(entryId: string, relativePath: string): string {
  assertEntryId(entryId)
  if (!relativePath || basename(relativePath) !== relativePath) {
    throw new Error('Invalid audio path')
  }
  return `desk://audio/${encodeURIComponent(entryId)}/${encodeURIComponent(relativePath)}`
}

function decodePlaybackSegment(segment: string): string {
  try {
    const decoded = decodeURIComponent(segment)
    if (encodeURIComponent(decoded) === segment) return decoded
    return segment
  } catch {
    return segment
  }
}

export function parseLocalPlaybackUrl(raw: string): { entryId: string; relativePath: string } | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'desk:' || url.hostname !== 'audio') return null
  const segments = url.pathname.split('/').filter((segment) => segment.length > 0)
  if (segments.length !== 2) return null
  const entryId = decodePlaybackSegment(segments[0])
  const relativePath = decodePlaybackSegment(segments[1])
  if (!ENTRY_ID.test(entryId)) return null
  if (!relativePath || basename(relativePath) !== relativePath) return null
  return { entryId, relativePath }
}

export function resolveLocalAudioFile(
  audioRoot: string,
  entryId: string,
  relativePath: string,
): string {
  if (
    !relativePath ||
    relativePath === '.' ||
    relativePath === '..' ||
    basename(relativePath) !== relativePath
  ) {
    throw new Error('Invalid audio path')
  }
  const dir = resolve(entryDir(audioRoot, entryId))
  const full = resolve(dir, relativePath)
  if (!full.startsWith(dir + sep)) throw new Error('Invalid audio path')
  return full
}
