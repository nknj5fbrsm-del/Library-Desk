import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { BrowserWindow, dialog } from 'electron'
import type { AppDatabase } from './db'
import { listEntries } from './entriesRepo'
import { buildSpdZipBuffer } from './spdBundle'
import {
  type AutoBackupSettings,
  type AutoBackupSettingsPatch,
  AUTO_BACKUP_PREFIX,
  backupFilename,
  filenamesToDelete,
  isAutoBackupFilename,
  needsCatchUp,
  nextDueAt,
  normalizeAutoBackupSettings,
} from '../shared/autoBackup'

export type AutoBackupDeps = {
  db: AppDatabase
  userData: string
  audioRoot: string
  coverRoot: string
  attachmentsRoot: string
  settingsPath: string
  defaultFolderPath: string
  notify?: (payload: { ok: boolean; message: string; filePath?: string }) => void
}

let timer: ReturnType<typeof setTimeout> | null = null
let running = false
let deps: AutoBackupDeps | null = null

export function defaultAutoBackupFolder(): string {
  return join(homedir(), 'Documents', 'Library Desk Backups')
}

export function settingsFilePath(userData: string): string {
  return join(userData, 'auto-backup.json')
}

export function readAutoBackupSettings(settingsPath: string, defaultFolderPath: string): AutoBackupSettings {
  try {
    if (!existsSync(settingsPath)) {
      return normalizeAutoBackupSettings(null, defaultFolderPath)
    }
    const raw = JSON.parse(readFileSync(settingsPath, 'utf8')) as Partial<AutoBackupSettings>
    return normalizeAutoBackupSettings(raw, defaultFolderPath)
  } catch {
    return normalizeAutoBackupSettings(null, defaultFolderPath)
  }
}

export function writeAutoBackupSettings(settingsPath: string, settings: AutoBackupSettings): void {
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
}

export function rotateAutoBackups(folderPath: string, retainCount: number): string[] {
  if (!existsSync(folderPath)) return []
  const names = readdirSync(folderPath)
    .filter((name) => isAutoBackupFilename(name))
    .sort((a, b) => b.localeCompare(a))
  const remove = filenamesToDelete(names, retainCount)
  for (const name of remove) {
    try {
      unlinkSync(join(folderPath, name))
    } catch {
      // ignore single delete failures
    }
  }
  return remove
}

export async function runAutoBackup(active: AutoBackupDeps = requireDeps()): Promise<{
  ok: boolean
  filePath?: string
  error?: string
}> {
  if (running) {
    return { ok: false, error: 'Backup läuft bereits.' }
  }
  running = true
  const settings = readAutoBackupSettings(active.settingsPath, active.defaultFolderPath)
  const attemptAt = new Date().toISOString()
  try {
    mkdirSync(settings.folderPath, { recursive: true })
    const entries = listEntries(active.db, {
      search: '',
      facet: 'all',
      kind: 'all',
      sort: 'newest',
    })
    const zip = await buildSpdZipBuffer(
      active.userData,
      active.audioRoot,
      active.coverRoot,
      active.attachmentsRoot,
      entries,
    )
    const finalName = backupFilename(new Date())
    const finalPath = join(settings.folderPath, finalName)
    const tempPath = `${finalPath}.tmp`
    writeFileSync(tempPath, Buffer.from(zip))
    renameSync(tempPath, finalPath)
    rotateAutoBackups(settings.folderPath, settings.retainCount)
    const next: AutoBackupSettings = {
      ...settings,
      lastAttemptAt: attemptAt,
      lastSuccessAt: attemptAt,
      lastError: null,
    }
    writeAutoBackupSettings(active.settingsPath, next)
    active.notify?.({ ok: true, message: 'Automatisches Backup gespeichert.', filePath: finalPath })
    return { ok: true, filePath: finalPath }
  } catch (cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause)
    const next: AutoBackupSettings = {
      ...settings,
      lastAttemptAt: attemptAt,
      lastError: message,
    }
    try {
      writeAutoBackupSettings(active.settingsPath, next)
    } catch {
      // ignore
    }
    active.notify?.({ ok: false, message: `Backup fehlgeschlagen: ${message}` })
    return { ok: false, error: message }
  } finally {
    running = false
  }
}

function requireDeps(): AutoBackupDeps {
  if (!deps) throw new Error('Auto-Backup nicht initialisiert')
  return deps
}

function clearTimer(): void {
  if (timer != null) {
    clearTimeout(timer)
    timer = null
  }
}

function scheduleNext(): void {
  clearTimer()
  const active = requireDeps()
  const settings = readAutoBackupSettings(active.settingsPath, active.defaultFolderPath)
  if (!settings.enabled) return
  const now = new Date()
  const due = nextDueAt(now, settings.timeMinutes)
  const delay = Math.max(1000, due.getTime() - now.getTime())
  timer = setTimeout(() => {
    void (async () => {
      await runAutoBackup(active)
      scheduleNext()
    })()
  }, delay)
}

export function startAutoBackupScheduler(active: AutoBackupDeps): void {
  deps = active
  const settings = readAutoBackupSettings(active.settingsPath, active.defaultFolderPath)
  if (settings.enabled && needsCatchUp(true, settings.lastSuccessAt, new Date(), settings.timeMinutes)) {
    void (async () => {
      await runAutoBackup(active)
      scheduleNext()
    })()
    return
  }
  scheduleNext()
}

export function stopAutoBackupScheduler(): void {
  clearTimer()
  deps = null
}

export function getAutoBackupSettings(): AutoBackupSettings {
  const active = requireDeps()
  return readAutoBackupSettings(active.settingsPath, active.defaultFolderPath)
}

export function updateAutoBackupSettings(patch: AutoBackupSettingsPatch): AutoBackupSettings {
  const active = requireDeps()
  const current = readAutoBackupSettings(active.settingsPath, active.defaultFolderPath)
  const merged: AutoBackupSettings = {
    ...current,
    enabled: patch.enabled ?? current.enabled,
    timeMinutes: patch.timeMinutes ?? current.timeMinutes,
    folderPath: patch.folderPath ?? current.folderPath,
    retainCount: patch.retainCount ?? current.retainCount,
  }
  const normalized = normalizeAutoBackupSettings(merged, active.defaultFolderPath)
  normalized.lastSuccessAt = current.lastSuccessAt
  normalized.lastError = current.lastError
  normalized.lastAttemptAt = current.lastAttemptAt
  writeAutoBackupSettings(active.settingsPath, normalized)
  scheduleNext()
  return normalized
}

export async function pickAutoBackupFolder(): Promise<string | null> {
  const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const current = getAutoBackupSettings()
  const result = parent
    ? await dialog.showOpenDialog(parent, {
        title: 'Backup-Ordner wählen',
        defaultPath: current.folderPath || defaultAutoBackupFolder(),
        properties: ['openDirectory', 'createDirectory'],
      })
    : await dialog.showOpenDialog({
        title: 'Backup-Ordner wählen',
        defaultPath: current.folderPath || defaultAutoBackupFolder(),
        properties: ['openDirectory', 'createDirectory'],
      })
  if (result.canceled || result.filePaths.length === 0) return null
  return updateAutoBackupSettings({ folderPath: result.filePaths[0] }).folderPath
}

export function broadcastAutoBackupNotice(payload: {
  ok: boolean
  message: string
  filePath?: string
}): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('autoBackup:notice', payload)
  }
}

export { AUTO_BACKUP_PREFIX }
