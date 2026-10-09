import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  copyLocalAttachment,
  deleteEntryAttachments,
  resolveLocalAttachmentFile,
  writeAttachmentFromBuffer,
} from '../src/main/attachmentFs'
import { attachmentsRootFor } from '../src/main/attachmentFs'
import { openDatabase } from '../src/main/db'
import { createEntry, getEntry, updateEntry } from '../src/main/entriesRepo'
import { buildSpdZipBuffer, importSpdZipBuffer } from '../src/main/spdBundle'
import { parseExportBundleDetailed } from '../src/shared/exportFormat'
import { unpackSpdZip } from '../src/shared/spdZip'
import { normalizeAttachments } from '../src/shared/types'

describe('attachments', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'desk-att-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('normalizes attachment refs', () => {
    expect(
      normalizeAttachments([
        { id: 'a', relativePath: 'a__x.pdf', originalName: 'x.pdf' },
        { id: 'a', relativePath: 'dup', originalName: 'dup.pdf' },
        { id: '', relativePath: 'z', originalName: 'z' },
      ]),
    ).toEqual([{ id: 'a', relativePath: 'a__x.pdf', originalName: 'x.pdf' }])
  })

  it('stores and exports general-prompt attachments in spd zip', async () => {
    const db = openDatabase(join(dir, 'library.db'))
    const userData = join(dir, 'userData')
    const entry = createEntry(db, {
      kind: 'general',
      title: 'Briefing',
      promptBody: 'Nutze die Anhänge',
    })
    const source = join(dir, 'notes.txt')
    writeFileSync(source, 'hello attachment')
    const attached = copyLocalAttachment(userData, entry.id, source)
    updateEntry(db, entry.id, { attachments: [attached] })

    const stored = getEntry(db, entry.id)
    expect(stored?.attachments).toHaveLength(1)
    expect(stored?.attachments[0]?.originalName).toBe('notes.txt')

    const filePath = resolveLocalAttachmentFile(
      attachmentsRootFor(userData),
      entry.id,
      attached.relativePath,
    )
    expect(filePath.endsWith(attached.relativePath)).toBe(true)

    const zip = await buildSpdZipBuffer(
      userData,
      join(userData, 'audio'),
      join(userData, 'covers'),
      attachmentsRootFor(userData),
      [getEntry(db, entry.id)!],
    )
    const unpacked = await unpackSpdZip(zip)
    const detailed = parseExportBundleDetailed(JSON.parse(unpacked.libraryJson) as unknown)
    expect(detailed.entries[0]?.attachmentFiles).toHaveLength(1)
    expect(detailed.entries[0]?.attachmentFiles[0]?.originalName).toBe('notes.txt')

    const importDir = join(dir, 'import')
    mkdirSync(importDir, { recursive: true })
    const importDb = openDatabase(join(importDir, 'library.db'))
    const importUser = join(importDir, 'userData')
    const result = await importSpdZipBuffer(importDb, importUser, zip)
    expect(result.created).toBe(1)
    const imported = getEntry(importDb, entry.id)
    expect(imported?.attachments).toHaveLength(1)
    expect(imported?.attachments[0]?.originalName).toBe('notes.txt')

    deleteEntryAttachments(userData, entry.id)
  })

  it('writes attachment buffers with stable ids', () => {
    const userData = join(dir, 'buf')
    const written = writeAttachmentFromBuffer(
      userData,
      'entry-1',
      'brief.pdf',
      new Uint8Array([1, 2, 3]),
      'att-fixed-id',
    )
    expect(written.id).toBe('att-fixed-id')
    expect(written.relativePath.startsWith('att-fixed-id__')).toBe(true)
  })
})
