import { copyFileSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import type { CoverRef } from '../shared/types'
import { assertEntryId, sanitizeFilename } from './audioFs'

const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i

export function coverRootFor(userData: string): string {
  return join(userData, 'covers')
}

function entryDir(coverRoot: string, entryId: string): string {
  return join(coverRoot, assertEntryId(entryId))
}

function extensionForMime(mime: string): string {
  const normalized = mime.toLowerCase()
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg'
  if (normalized === 'image/png') return 'png'
  if (normalized === 'image/webp') return 'webp'
  if (normalized === 'image/gif') return 'gif'
  return 'img'
}

function writeCoverFile(
  userData: string,
  entryId: string,
  relativePath: string,
  originalName: string,
  write: (target: string) => void,
): CoverRef {
  const coverRoot = coverRootFor(userData)
  const dir = entryDir(coverRoot, entryId)
  const staging = join(userData, `.cover-staging-${assertEntryId(entryId)}`)
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  try {
    write(join(staging, relativePath))
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(coverRoot, { recursive: true })
    renameSync(staging, dir)
  } catch (error) {
    rmSync(staging, { recursive: true, force: true })
    throw error
  }
  return { relativePath, originalName }
}

export function writeCoverFromDataUrl(
  userData: string,
  entryId: string,
  dataUrl: string,
): CoverRef | null {
  const match = DATA_URL_RE.exec(dataUrl.trim())
  if (!match) return null
  const mime = match[1]
  const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64')
  if (buffer.length === 0) return null

  const originalName = `cover.${extensionForMime(mime)}`
  const relativePath = sanitizeFilename(originalName)
  return writeCoverFile(userData, entryId, relativePath, originalName, (target) => {
    writeFileSync(target, buffer)
  })
}

export function copyLocalCover(
  userData: string,
  entryId: string,
  sourcePath: string,
): CoverRef {
  const originalName = basename(sourcePath)
  const relativePath = sanitizeFilename(originalName)
  return writeCoverFile(userData, entryId, relativePath, originalName, (target) => {
    copyFileSync(sourcePath, target)
  })
}

export function writeCoverFromBuffer(
  userData: string,
  entryId: string,
  originalName: string,
  data: Uint8Array,
): CoverRef {
  const relativePath = sanitizeFilename(originalName)
  return writeCoverFile(userData, entryId, relativePath, originalName, (target) => {
    writeFileSync(target, Buffer.from(data))
  })
}

export function deleteEntryCover(userData: string, entryId: string): void {
  rmSync(entryDir(coverRootFor(userData), entryId), { recursive: true, force: true })
}

export function coverDisplayUrl(entryId: string, relativePath: string): string {
  assertEntryId(entryId)
  if (!relativePath || basename(relativePath) !== relativePath) {
    throw new Error('Invalid cover path')
  }
  return `desk://cover/${encodeURIComponent(entryId)}/${encodeURIComponent(relativePath)}`
}

function decodeSegment(segment: string): string {
  try {
    const decoded = decodeURIComponent(segment)
    if (encodeURIComponent(decoded) === segment) return decoded
    return segment
  } catch {
    return segment
  }
}

export function parseCoverDisplayUrl(
  raw: string,
): { entryId: string; relativePath: string } | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'desk:' || url.hostname !== 'cover') return null
  const segments = url.pathname.split('/').filter((segment) => segment.length > 0)
  if (segments.length !== 2) return null
  const entryId = decodeSegment(segments[0])
  const relativePath = decodeSegment(segments[1])
  try {
    assertEntryId(entryId)
  } catch {
    return null
  }
  if (!relativePath || basename(relativePath) !== relativePath) return null
  return { entryId, relativePath }
}

export function resolveLocalCoverFile(
  coverRoot: string,
  entryId: string,
  relativePath: string,
): string {
  if (
    !relativePath
    || relativePath === '.'
    || relativePath === '..'
    || basename(relativePath) !== relativePath
  ) {
    throw new Error('Invalid cover path')
  }
  const dir = resolve(entryDir(coverRoot, entryId))
  const full = resolve(dir, relativePath)
  if (!full.startsWith(dir + sep)) throw new Error('Invalid cover path')
  return full
}

export function copyCoverBetweenEntries(
  userData: string,
  sourceId: string,
  targetId: string,
  relativePath: string,
): CoverRef {
  const coverRoot = coverRootFor(userData)
  const sourcePath = resolveLocalCoverFile(coverRoot, sourceId, relativePath)
  return copyLocalCover(userData, targetId, sourcePath)
}
