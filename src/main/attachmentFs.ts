import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AttachmentRef } from '../shared/types'
import { assertEntryId, sanitizeFilename } from './audioFs'

export function attachmentsRootFor(userData: string): string {
  return join(userData, 'attachments')
}

function entryDir(attachmentsRoot: string, entryId: string): string {
  return join(attachmentsRoot, assertEntryId(entryId))
}

function assertAttachmentId(attachmentId: string): string {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(attachmentId)) throw new Error('Invalid attachment id')
  return attachmentId
}

function relativeName(attachmentId: string, originalName: string): string {
  return `${assertAttachmentId(attachmentId)}__${sanitizeFilename(originalName)}`
}

export function resolveLocalAttachmentFile(
  attachmentsRoot: string,
  entryId: string,
  relativePath: string,
): string {
  if (
    !relativePath ||
    relativePath === '.' ||
    relativePath === '..' ||
    basename(relativePath) !== relativePath
  ) {
    throw new Error('Invalid attachment path')
  }
  const dir = resolve(entryDir(attachmentsRoot, entryId))
  const full = resolve(dir, relativePath)
  if (!full.startsWith(dir + sep)) throw new Error('Invalid attachment path')
  return full
}

export function copyLocalAttachment(
  userData: string,
  entryId: string,
  sourcePath: string,
  attachmentId: string = randomUUID(),
): AttachmentRef {
  const originalName = basename(sourcePath)
  const relativePath = relativeName(attachmentId, originalName)
  const dir = entryDir(attachmentsRootFor(userData), entryId)
  mkdirSync(dir, { recursive: true })
  copyFileSync(sourcePath, join(dir, relativePath))
  return { id: attachmentId, relativePath, originalName }
}

export function writeAttachmentFromBuffer(
  userData: string,
  entryId: string,
  originalName: string,
  data: Uint8Array,
  attachmentId: string = randomUUID(),
): AttachmentRef {
  const relativePath = relativeName(attachmentId, originalName)
  const dir = entryDir(attachmentsRootFor(userData), entryId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, relativePath), Buffer.from(data))
  return { id: attachmentId, relativePath, originalName }
}

export function deleteAttachmentFile(
  userData: string,
  entryId: string,
  relativePath: string,
): void {
  try {
    const filePath = resolveLocalAttachmentFile(
      attachmentsRootFor(userData),
      entryId,
      relativePath,
    )
    rmSync(filePath, { force: true })
  } catch {
    // missing / invalid
  }
}

export function deleteEntryAttachments(userData: string, entryId: string): void {
  rmSync(entryDir(attachmentsRootFor(userData), entryId), { recursive: true, force: true })
}

export function copyAttachmentsBetweenEntries(
  userData: string,
  sourceId: string,
  targetId: string,
  attachments: AttachmentRef[],
): AttachmentRef[] {
  const root = attachmentsRootFor(userData)
  const copied: AttachmentRef[] = []
  for (const item of attachments) {
    try {
      const sourcePath = resolveLocalAttachmentFile(root, sourceId, item.relativePath)
      if (!existsSync(sourcePath)) continue
      const next = copyLocalAttachment(userData, targetId, sourcePath, randomUUID())
      copied.push({ ...next, originalName: item.originalName })
    } catch {
      // skip missing
    }
  }
  return copied
}

/** Remove orphaned files that are no longer referenced. */
export function pruneEntryAttachmentDir(
  userData: string,
  entryId: string,
  attachments: AttachmentRef[],
): void {
  const dir = entryDir(attachmentsRootFor(userData), entryId)
  if (!existsSync(dir)) return
  const keep = new Set(attachments.map((item) => item.relativePath))
  for (const name of readdirSync(dir)) {
    if (keep.has(name)) continue
    rmSync(join(dir, name), { force: true })
  }
}
