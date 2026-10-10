import { describe, expect, it } from 'vitest'
import {
  AUTO_BACKUP_DEFAULT_TIME_MINUTES,
  backupFilename,
  filenamesToDelete,
  inputValueToTimeMinutes,
  isAutoBackupFilename,
  needsCatchUp,
  nextDueAt,
  startOfLastDueSlot,
  timeMinutesToInputValue,
} from '../src/shared/autoBackup'

describe('autoBackup schedule', () => {
  it('maps 03:00 to 180 minutes and back', () => {
    expect(AUTO_BACKUP_DEFAULT_TIME_MINUTES).toBe(180)
    expect(timeMinutesToInputValue(180)).toBe('03:00')
    expect(inputValueToTimeMinutes('03:00')).toBe(180)
  })

  it('picks the previous slot before today time and today after', () => {
    const before = new Date(2026, 9, 10, 2, 30, 0) // Oct 10 local
    const after = new Date(2026, 9, 10, 3, 15, 0)
    expect(startOfLastDueSlot(before, 180)).toEqual(new Date(2026, 9, 9, 3, 0, 0))
    expect(startOfLastDueSlot(after, 180)).toEqual(new Date(2026, 9, 10, 3, 0, 0))
  })

  it('schedules the next slot strictly in the future', () => {
    const before = new Date(2026, 9, 10, 2, 30, 0)
    const exactly = new Date(2026, 9, 10, 3, 0, 0)
    expect(nextDueAt(before, 180)).toEqual(new Date(2026, 9, 10, 3, 0, 0))
    expect(nextDueAt(exactly, 180)).toEqual(new Date(2026, 9, 11, 3, 0, 0))
  })

  it('needs catch-up when never succeeded or success before last due slot', () => {
    const now = new Date(2026, 9, 10, 10, 0, 0)
    expect(needsCatchUp(false, null, now, 180)).toBe(false)
    expect(needsCatchUp(true, null, now, 180)).toBe(true)
    expect(needsCatchUp(true, new Date(2026, 9, 10, 3, 5, 0).toISOString(), now, 180)).toBe(false)
    expect(needsCatchUp(true, new Date(2026, 9, 9, 3, 0, 0).toISOString(), now, 180)).toBe(true)
  })
})

describe('autoBackup filenames', () => {
  it('builds dated names and recognizes the prefix', () => {
    const name = backupFilename(new Date(2026, 9, 10, 3, 0, 0))
    expect(name).toBe('library-desk-backup-2026-10-10-0300.spd.zip')
    expect(isAutoBackupFilename(name)).toBe(true)
    expect(isAutoBackupFilename('library.spd.zip')).toBe(false)
  })

  it('rotates only beyond retain count', () => {
    const files = [
      'library-desk-backup-2026-10-10-0300.spd.zip',
      'library-desk-backup-2026-10-09-0300.spd.zip',
      'library-desk-backup-2026-10-08-0300.spd.zip',
    ]
    expect(filenamesToDelete(files, 2)).toEqual(['library-desk-backup-2026-10-08-0300.spd.zip'])
    expect(filenamesToDelete(files, 14)).toEqual([])
  })
})
