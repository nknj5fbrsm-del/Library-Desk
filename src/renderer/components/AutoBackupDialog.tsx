import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getDesk } from '@renderer/api'
import type { AutoBackupSettings, AutoBackupSettingsPatch } from '@shared/autoBackup'
import {
  AUTO_BACKUP_DEFAULT_RETAIN,
  AUTO_BACKUP_RETAIN_MAX,
  AUTO_BACKUP_RETAIN_MIN,
  inputValueToTimeMinutes,
  timeMinutesToInputValue,
} from '@shared/autoBackup'

interface AutoBackupDialogProps {
  onClose: () => void
  onNotice: (message: string) => void
}

function formatStatus(settings: AutoBackupSettings): string {
  if (settings.lastError) return `Letzter Fehler: ${settings.lastError}`
  if (settings.lastSuccessAt) {
    try {
      return `Zuletzt: ${new Date(settings.lastSuccessAt).toLocaleString('de-DE')}`
    } catch {
      return `Zuletzt: ${settings.lastSuccessAt}`
    }
  }
  return 'Noch kein automatisches Backup.'
}

export function AutoBackupDialog({ onClose, onNotice }: AutoBackupDialogProps): JSX.Element {
  const [settings, setSettings] = useState<AutoBackupSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [timeValue, setTimeValue] = useState('03:00')
  const [retain, setRetain] = useState(String(AUTO_BACKUP_DEFAULT_RETAIN))

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next = await getDesk().autoBackup.getSettings()
      if (cancelled) return
      setSettings(next)
      setTimeValue(timeMinutesToInputValue(next.timeMinutes))
      setRetain(String(next.retainCount))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function applyPatch(patch: AutoBackupSettingsPatch): Promise<void> {
    setBusy(true)
    try {
      const next = await getDesk().autoBackup.setSettings(patch)
      setSettings(next)
      setTimeValue(timeMinutesToInputValue(next.timeMinutes))
      setRetain(String(next.retainCount))
    } catch (cause: unknown) {
      onNotice(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  async function onToggle(enabled: boolean): Promise<void> {
    await applyPatch({ enabled })
  }

  async function onTimeBlur(): Promise<void> {
    const minutes = inputValueToTimeMinutes(timeValue)
    setTimeValue(timeMinutesToInputValue(minutes))
    if (settings && minutes !== settings.timeMinutes) {
      await applyPatch({ timeMinutes: minutes })
    }
  }

  async function onRetainBlur(): Promise<void> {
    const parsed = Number(retain)
    const value = Number.isFinite(parsed)
      ? Math.min(AUTO_BACKUP_RETAIN_MAX, Math.max(AUTO_BACKUP_RETAIN_MIN, Math.round(parsed)))
      : AUTO_BACKUP_DEFAULT_RETAIN
    setRetain(String(value))
    if (settings && value !== settings.retainCount) {
      await applyPatch({ retainCount: value })
    }
  }

  async function onPickFolder(): Promise<void> {
    setBusy(true)
    try {
      const folder = await getDesk().autoBackup.pickFolder()
      if (folder) {
        setSettings(await getDesk().autoBackup.getSettings())
      }
    } catch (cause: unknown) {
      onNotice(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  async function onRunNow(): Promise<void> {
    setBusy(true)
    try {
      const result = await getDesk().autoBackup.runNow()
      setSettings(await getDesk().autoBackup.getSettings())
      if (result.ok) onNotice('Automatisches Backup gespeichert.')
      else onNotice(result.error ? `Backup fehlgeschlagen: ${result.error}` : 'Backup fehlgeschlagen.')
    } catch (cause: unknown) {
      onNotice(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <div
        className="dialog auto-backup-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-backup-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="auto-backup-title" className="dialog-title">
          Automatisches Backup
        </h2>
        <p className="dialog-hint">
          Täglich ein volles <code>.spd.zip</code> in den gewählten Ordner — nur Desktop, App muss laufen
          (verpasste Läufe beim Start nachholen). Beim Beenden der App wird immer gefragt, ob ein Backup
          angelegt werden soll.
        </p>
        {settings ? (
          <div className="auto-backup-form">
            <label className="auto-backup-row">
              <input
                type="checkbox"
                checked={settings.enabled}
                disabled={busy}
                onChange={(event) => void onToggle(event.target.checked)}
              />
              <span>Automatisches Backup aktiv</span>
            </label>
            <label className="auto-backup-field">
              <span>Uhrzeit</span>
              <input
                type="time"
                value={timeValue}
                disabled={busy}
                onChange={(event) => setTimeValue(event.target.value)}
                onBlur={() => void onTimeBlur()}
              />
            </label>
            <label className="auto-backup-field">
              <span>Behalten (Dateien)</span>
              <input
                type="number"
                min={AUTO_BACKUP_RETAIN_MIN}
                max={AUTO_BACKUP_RETAIN_MAX}
                value={retain}
                disabled={busy}
                onChange={(event) => setRetain(event.target.value)}
                onBlur={() => void onRetainBlur()}
              />
            </label>
            <div className="auto-backup-field">
              <span>Ordner</span>
              <p className="auto-backup-path" title={settings.folderPath}>
                {settings.folderPath || '—'}
              </p>
              <button type="button" className="btn" disabled={busy} onClick={() => void onPickFolder()}>
                Ordner wählen…
              </button>
            </div>
            <p className="auto-backup-status" role="status">
              {formatStatus(settings)}
            </p>
          </div>
        ) : (
          <p className="dialog-hint">Laden…</p>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn" disabled={busy} onClick={() => void onRunNow()}>
            Jetzt sichern
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
