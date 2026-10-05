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
          className="btn"
          disabled={disabled}
          onClick={() => void run(() => getDesk().cover.attachLocal(entry.id))}
        >
          Hochladen
        </button>
        <button
          type="button"
          className="btn"
          disabled={disabled || !entry.cover}
          onClick={() => void run(() => getDesk().cover.download(entry.id))}
        >
          Download
        </button>
        <button
          type="button"
          className="btn"
          disabled={disabled || !entry.cover}
          onClick={() => void run(() => getDesk().cover.clear(entry.id))}
        >
          Entfernen
        </button>
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
