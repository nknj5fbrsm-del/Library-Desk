import { useEffect, useState } from 'react'
import { getDesk } from '@renderer/api'
import type { Entry } from '@shared/types'

interface CoverPanelProps {
  entry: Entry
  busy: boolean
  onChange: (entry: Entry) => void
}

export function CoverPanel({ entry, busy, onChange }: CoverPanelProps): JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [localBusy, setLocalBusy] = useState(false)

  useEffect(() => {
    if (!entry.cover) {
      setSrc(null)
      return
    }
    let cancelled = false
    void getDesk()
      .cover.resolveUrl(entry.id)
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [entry.id, entry.cover?.relativePath])

  async function run(action: () => Promise<Entry | { filePath: string } | null>): Promise<void> {
    setLocalBusy(true)
    setNote(null)
    try {
      const result = await action()
      if (result && 'id' in result) onChange(result)
      if (result && 'filePath' in result) setNote('Cover gespeichert.')
    } catch (cause: unknown) {
      setNote(cause instanceof Error ? cause.message : 'Cover-Aktion fehlgeschlagen.')
    } finally {
      setLocalBusy(false)
    }
  }

  const disabled = busy || localBusy

  return (
    <section className="cover-panel" aria-label="Cover">
      <div className="cover-main">
        {src ? (
          <button
            type="button"
            className="cover-preview-btn"
            onClick={() => setPreviewOpen(true)}
            title="Große Vorschau"
          >
            <img className="cover-thumb cover-thumb-detail" src={src} alt="" draggable={false} />
          </button>
        ) : (
          <div className="cover-placeholder">Kein Cover</div>
        )}
        <div className="cover-actions">
          <button
            type="button"
            className="cover-icon-btn"
            disabled={disabled}
            aria-label="Cover hochladen"
            title="Hochladen"
            onClick={() => void run(() => getDesk().cover.attachLocal(entry.id))}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M7.25 10.5V4.56L5.28 6.53a.75.75 0 0 1-1.06-1.06l3.25-3.25a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 1 1-1.06 1.06L8.75 4.56V10.5a.75.75 0 0 1-1.5 0zM3.75 12.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5z"
              />
            </svg>
          </button>
          <button
            type="button"
            className="cover-icon-btn"
            disabled={disabled || !entry.cover}
            aria-label="Cover herunterladen"
            title="Download"
            onClick={() => void run(() => getDesk().cover.download(entry.id))}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M8.75 2.25v5.94l1.97-1.97a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 1.06-1.06l1.97 1.97V2.25a.75.75 0 0 1 1.5 0zM3.75 12.25a.75.75 0 0 0 0 1.5h8.5a.75.75 0 0 0 0-1.5h-8.5z"
              />
            </svg>
          </button>
          <button
            type="button"
            className="cover-icon-btn"
            disabled={disabled || !entry.cover}
            aria-label="Cover entfernen"
            title="Entfernen"
            onClick={() => void run(() => getDesk().cover.clear(entry.id))}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M6.25 2a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5zM3 4.25h10a.75.75 0 0 1 0 1.5h-.4l-.45 7.05A1.75 1.75 0 0 1 10.41 14.5H5.59a1.75 1.75 0 0 1-1.74-1.7L3.4 5.75H3a.75.75 0 0 1 0-1.5zm2.16 1.5.43 6.75h4.82l.43-6.75H5.16z"
              />
            </svg>
          </button>
        </div>
      </div>
      {note ? (
        <p className="cover-note" role="status">
          {note}
        </p>
      ) : null}
      {previewOpen && src ? (
        <div
          className="cover-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Cover-Vorschau"
          onMouseDown={() => setPreviewOpen(false)}
        >
          <button
            type="button"
            className="cover-lightbox-close"
            aria-label="Vorschau schließen"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setPreviewOpen(false)}
          >
            ×
          </button>
          <img
            src={src}
            alt=""
            className="cover-lightbox-img"
            draggable={false}
            title="Klicken zum Schließen"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setPreviewOpen(false)}
          />
        </div>
      ) : null}
    </section>
  )
}

interface CoverThumbProps {
  entry: Entry
}

export function CoverThumb({ entry }: CoverThumbProps): JSX.Element | null {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!entry.cover) {
      setSrc(null)
      return
    }
    let cancelled = false
    void getDesk()
      .cover.resolveUrl(entry.id)
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [entry.id, entry.cover?.relativePath])

  if (!src) return null
  return <img className="cover-thumb" src={src} alt="" draggable={false} />
}
