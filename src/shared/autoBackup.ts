export const AUTO_BACKUP_PREFIX = 'library-desk-backup-'
export const AUTO_BACKUP_DEFAULT_TIME_MINUTES = 180 // 03:00
export const AUTO_BACKUP_DEFAULT_RETAIN = 14
export const AUTO_BACKUP_RETAIN_MIN = 1
export const AUTO_BACKUP_RETAIN_MAX = 90

export interface AutoBackupSettings {
  enabled: boolean
  /** Minuten seit Mitternacht lokal, 0–1439 */
  timeMinutes: number
  folderPath: string
  retainCount: number
  lastSuccessAt: string | null
  lastError: string | null
  lastAttemptAt: string | null
}

export type AutoBackupSettingsPatch = Partial<
  Pick<AutoBackupSettings, 'enabled' | 'timeMinutes' | 'folderPath' | 'retainCount'>
>

export function clampTimeMinutes(value: number): number {
  if (!Number.isFinite(value)) return AUTO_BACKUP_DEFAULT_TIME_MINUTES
  return Math.min(1439, Math.max(0, Math.round(value)))
}

export function clampRetainCount(value: number): number {
  if (!Number.isFinite(value)) return AUTO_BACKUP_DEFAULT_RETAIN
  return Math.min(AUTO_BACKUP_RETAIN_MAX, Math.max(AUTO_BACKUP_RETAIN_MIN, Math.round(value)))
}

export function timeMinutesToInputValue(timeMinutes: number): string {
  const clamped = clampTimeMinutes(timeMinutes)
  const hours = Math.floor(clamped / 60)
  const minutes = clamped % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function inputValueToTimeMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return AUTO_BACKUP_DEFAULT_TIME_MINUTES
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return AUTO_BACKUP_DEFAULT_TIME_MINUTES
  return clampTimeMinutes(hours * 60 + minutes)
}

/** Start des letzten fälligen Backup-Slots (lokal) relativ zu `now`. */
export function startOfLastDueSlot(now: Date, timeMinutes: number): Date {
  const minutes = clampTimeMinutes(timeMinutes)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  const slot = new Date(now)
  slot.setSeconds(0, 0)
  slot.setHours(hours, mins, 0, 0)
  if (now.getTime() < slot.getTime()) {
    slot.setDate(slot.getDate() - 1)
  }
  return slot
}

/** Nächster geplanter Zeitpunkt (strikt in der Zukunft). */
export function nextDueAt(now: Date, timeMinutes: number): Date {
  const minutes = clampTimeMinutes(timeMinutes)
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  const next = new Date(now)
  next.setSeconds(0, 0)
  next.setHours(hours, mins, 0, 0)
  if (now.getTime() >= next.getTime()) {
    next.setDate(next.getDate() + 1)
  }
  return next
}

export function needsCatchUp(
  enabled: boolean,
  lastSuccessAt: string | null,
  now: Date,
  timeMinutes: number,
): boolean {
  if (!enabled) return false
  const due = startOfLastDueSlot(now, timeMinutes)
  if (lastSuccessAt == null) return true
  const success = Date.parse(lastSuccessAt)
  if (!Number.isFinite(success)) return true
  return success < due.getTime()
}

export function backupFilename(when: Date = new Date()): string {
  const y = when.getFullYear()
  const m = String(when.getMonth() + 1).padStart(2, '0')
  const d = String(when.getDate()).padStart(2, '0')
  const hh = String(when.getHours()).padStart(2, '0')
  const mm = String(when.getMinutes()).padStart(2, '0')
  return `${AUTO_BACKUP_PREFIX}${y}-${m}-${d}-${hh}${mm}.spd.zip`
}

export function isAutoBackupFilename(name: string): boolean {
  return name.startsWith(AUTO_BACKUP_PREFIX) && name.endsWith('.spd.zip')
}

/** Dateinamen behalten (neueste zuerst angenommen); Rest löschen. */
export function filenamesToDelete(sortedNewestFirst: string[], retainCount: number): string[] {
  const keep = clampRetainCount(retainCount)
  if (sortedNewestFirst.length <= keep) return []
  return sortedNewestFirst.slice(keep)
}

export function normalizeAutoBackupSettings(
  raw: Partial<AutoBackupSettings> | null | undefined,
  defaultFolderPath: string,
): AutoBackupSettings {
  return {
    enabled: Boolean(raw?.enabled),
    timeMinutes: clampTimeMinutes(raw?.timeMinutes ?? AUTO_BACKUP_DEFAULT_TIME_MINUTES),
    folderPath:
      typeof raw?.folderPath === 'string' && raw.folderPath.trim()
        ? raw.folderPath.trim()
        : defaultFolderPath,
    retainCount: clampRetainCount(raw?.retainCount ?? AUTO_BACKUP_DEFAULT_RETAIN),
    lastSuccessAt: typeof raw?.lastSuccessAt === 'string' ? raw.lastSuccessAt : null,
    lastError: typeof raw?.lastError === 'string' ? raw.lastError : null,
    lastAttemptAt: typeof raw?.lastAttemptAt === 'string' ? raw.lastAttemptAt : null,
  }
}
