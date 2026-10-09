import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { EntryKind } from '@shared/types'

interface NewKindDialogProps {
  onPick: (kind: EntryKind) => void
  onCancel: () => void
}

export function NewKindDialog({ onPick, onCancel }: NewKindDialogProps): JSX.Element {
  const firstRef = useRef<HTMLButtonElement>(null)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    firstRef.current?.focus()

    function onKey(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onCancelRef.current()
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={onCancel}>
      <div
        className="dialog new-kind-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-kind-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p id="new-kind-dialog-title" className="dialog-message">
          Was möchtest du anlegen?
        </p>
        <div className="new-kind-actions">
          <button
            ref={firstRef}
            type="button"
            className="btn btn-primary new-kind-choice"
            onClick={() => onPick('suno')}
          >
            Suno-Prompt
          </button>
          <button
            type="button"
            className="btn new-kind-choice"
            onClick={() => onPick('general')}
          >
            Allgemeiner Prompt
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
