import { mkdirSync, mkdtempSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { rotateAutoBackups } from '../src/main/autoBackupService'

describe('rotateAutoBackups', () => {
  let dir: string

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('keeps newest N auto-backup files and ignores other names', () => {
    dir = mkdtempSync(join(tmpdir(), 'desk-backup-'))
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'library-desk-backup-2026-10-10-0300.spd.zip'), 'a')
    writeFileSync(join(dir, 'library-desk-backup-2026-10-09-0300.spd.zip'), 'b')
    writeFileSync(join(dir, 'library-desk-backup-2026-10-08-0300.spd.zip'), 'c')
    writeFileSync(join(dir, 'manual-export.spd.zip'), 'keep')
    const removed = rotateAutoBackups(dir, 2)
    expect(removed).toEqual(['library-desk-backup-2026-10-08-0300.spd.zip'])
    const left = readdirSync(dir).sort()
    expect(left).toEqual([
      'library-desk-backup-2026-10-09-0300.spd.zip',
      'library-desk-backup-2026-10-10-0300.spd.zip',
      'manual-export.spd.zip',
    ])
  })
})
