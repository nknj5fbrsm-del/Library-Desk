import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  formatCopyBoth,
  formatCopyLyrics,
  formatCopyStyle,
} from '@shared/copyFormat'
import type { UpdateEntryPatch } from '@shared/deskApi'
import type { Entry } from '@shared/types'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'

const SAVE_DELAY_MS = 400

const timeFormat = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

interface Draft {
  title: string
  stylePrompt: string
  lyrics: string
  notes: string
  tags: string[]
  isPower: boolean
}

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'
type CopyPart = 'style' | 'lyrics' | 'both'

export interface EditorHandle {
  flush: () => Promise<void>
  copyStyle: () => Promise<void>
  copyLyrics: () => Promise<void>
  copyBoth: () => Promise<void>
  requestDelete: () => void
}

interface EntryEditorProps {
  entry: Entry
  busy: boolean
  onUpdate: (id: string, patch: UpdateEntryPatch) => Promise<Entry>
  onDuplicate: (id: string) => Promise<void>
  onCreateVersion: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function toDraft(entry: Entry): Draft {
  return {
    title: entry.title,
    stylePrompt: entry.stylePrompt,
    lyrics: entry.lyrics,
    notes: entry.notes,
    tags: [...entry.tags],
    isPower: entry.isPower,
  }
}

function mergeTags(draft: Draft, raw: string): Draft {
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  if (parts.length === 0) return draft
  const tags = [...draft.tags]
  let changed = false
  for (const part of parts) {
    const key = part.toLocaleLowerCase('de')
    if (tags.some((tag) => tag.toLocaleLowerCase('de') === key)) continue
    tags.push(part)
    changed = true
  }
  return changed ? { ...draft, tags } : draft
}

export const EntryEditor = forwardRef<EditorHandle, EntryEditorProps>(function EntryEditor(
  { entry, busy, onUpdate, onDuplicate, onCreateVersion, onDelete },
  ref,
): JSX.Element {
  const [draft, setDraft] = useState<Draft>(() => toDraft(entry))
  const [tagInput, setTagInput] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [copyNote, setCopyNote] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const draftRef = useRef(draft)
  const tagInputRef = useRef('')
  const entryIdRef = useRef(entry.id)
  const dirtyRef = useRef(false)
  const actingRef = useRef(false)
  const mountedRef = useRef(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const onUpdateRef = useRef(onUpdate)
  const onDuplicateRef = useRef(onDuplicate)
  const onCreateVersionRef = useRef(onCreateVersion)
  const onDeleteRef = useRef(onDelete)
  const flushRef = useRef<() => Promise<void>>(async () => undefined)
  const copyRef = useRef<(part: CopyPart) => Promise<void>>(async () => undefined)

  entryIdRef.current = entry.id
  onUpdateRef.current = onUpdate
  onDuplicateRef.current = onDuplicate
  onCreateVersionRef.current = onCreateVersion
  onDeleteRef.current = onDelete

  function applyDraft(next: Draft, markDirty: boolean): void {
    draftRef.current = next
    setDraft(next)
    if (!markDirty) return
    dirtyRef.current = true
    setSaveState('pending')
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void flushRef.current()
    }, SAVE_DELAY_MS)
  }

  function patchDraft(partial: Partial<Draft>): void {
    applyDraft({ ...draftRef.current, ...partial }, true)
  }

  function absorbTagInput(): void {
    const raw = tagInputRef.current
    if (!raw.trim()) return
    const next = mergeTags(draftRef.current, raw)
    tagInputRef.current = ''
    setTagInput('')
    if (next === draftRef.current) return
    draftRef.current = next
    setDraft(next)
    dirtyRef.current = true
  }

  async function writeIfDirty(): Promise<void> {
    absorbTagInput()
    if (!dirtyRef.current) return
    dirtyRef.current = false
    const id = entryIdRef.current
    const sent = draftRef.current
    const patch: UpdateEntryPatch = {
      title: sent.title,
      stylePrompt: sent.stylePrompt,
      lyrics: sent.lyrics,
      notes: sent.notes,
      tags: [...sent.tags],
      isPower: sent.isPower,
    }
    if (mountedRef.current) setSaveState('saving')
    try {
      const saved = await onUpdateRef.current(id, patch)
      if (!mountedRef.current || entryIdRef.current !== id) return
      if (draftRef.current.title === sent.title && saved.title !== sent.title) {
        const next = { ...draftRef.current, title: saved.title }
        draftRef.current = next
        setDraft(next)
      }
      setSaveState(dirtyRef.current ? 'pending' : 'saved')
    } catch (cause) {
      dirtyRef.current = true
      if (mountedRef.current) setSaveState('error')
      throw cause
    }
  }

  function flush(): Promise<void> {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const job = queueRef.current.then(writeIfDirty)
    queueRef.current = job.then(
      () => undefined,
      () => undefined,
    )
    return job
  }

  flushRef.current = flush

  async function copyPart(part: CopyPart): Promise<void> {
    absorbTagInput()
    const current = draftRef.current
    const text =
      part === 'style'
        ? formatCopyStyle(current.stylePrompt)
        : part === 'lyrics'
          ? formatCopyLyrics(current.lyrics)
          : formatCopyBoth(current.stylePrompt, current.lyrics)
    try {
      await navigator.clipboard.writeText(text)
      setCopyNote('Kopiert')
    } catch {
      setCopyNote('Kopieren fehlgeschlagen')
    }
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
    copyTimerRef.current = setTimeout(() => {
      copyTimerRef.current = null
      setCopyNote(null)
    }, 1600)
  }

  copyRef.current = copyPart

  useImperativeHandle(
    ref,
    () => ({
      flush: () => flushRef.current(),
      copyStyle: () => copyRef.current('style'),
      copyLyrics: () => copyRef.current('lyrics'),
      copyBoth: () => copyRef.current('both'),
      requestDelete: () => setConfirmOpen(true),
    }),
    [],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current)
      void flushRef.current().catch(() => undefined)
    }
  }, [])

  async function runStructural(action: (id: string) => Promise<void>): Promise<void> {
    if (actingRef.current) return
    actingRef.current = true
    try {
      await flushRef.current()
      await action(entryIdRef.current)
    } catch {
      return
    } finally {
      actingRef.current = false
    }
  }

  function commitTagField(raw: string, remainder = ''): void {
    const next = mergeTags(draftRef.current, raw)
    tagInputRef.current = remainder
    setTagInput(remainder)
    if (next !== draftRef.current) applyDraft(next, true)
  }

  const saveLabel =
    saveState === 'saving'
      ? 'Speichert…'
      : saveState === 'saved'
        ? 'Gespeichert'
        : saveState === 'error'
          ? 'Speichern fehlgeschlagen'
          : null

  return (
    <div className="editor">
      <div className="editor-head">
        <input
          className="title-input"
          aria-label="Titel"
          value={draft.title}
          placeholder="Ohne Titel"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => patchDraft({ title: event.target.value })}
        />
        <label className="power-toggle">
          <input
            type="checkbox"
            checked={draft.isPower}
            onChange={(event) => patchDraft({ isPower: event.target.checked })}
          />
          Power
        </label>
      </div>
      <p className="meta">
        Version {entry.version}
        {' · '}
        Erstellt {timeFormat.format(entry.createdAt)}
        {' · '}
        Geändert {timeFormat.format(entry.updatedAt)}
        {saveLabel ? <span className="save-state"> · {saveLabel}</span> : null}
      </p>
      <div className="editor-actions">
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void runStructural(onCreateVersionRef.current)}
        >
          Version anlegen
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void runStructural(onDuplicateRef.current)}
        >
          Duplizieren
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy}
          onClick={() => setConfirmOpen(true)}
        >
          Löschen
        </button>
        <span className="action-gap" />
        <button type="button" className="btn" onClick={() => void copyPart('style')}>
          Style kopieren
        </button>
        <button type="button" className="btn" onClick={() => void copyPart('lyrics')}>
          Lyrics kopieren
        </button>
        <button type="button" className="btn" onClick={() => void copyPart('both')}>
          Beides kopieren
        </button>
        {copyNote ? (
          <span className="copy-note" role="status">
            {copyNote}
          </span>
        ) : null}
      </div>
      <label className="field">
        <span className="field-label">Tags</span>
        <div className="tag-editor">
          {draft.tags.map((tag) => (
            <span key={tag.toLocaleLowerCase('de')} className="tag-chip">
              {tag}
              <button
                type="button"
                className="tag-remove"
                aria-label={`${tag} entfernen`}
                onClick={() =>
                  patchDraft({ tags: draftRef.current.tags.filter((item) => item !== tag) })
                }
              >
                ×
              </button>
            </span>
          ))}
          <input
            aria-label="Tag hinzufügen"
            placeholder="Tag, Enter"
            autoComplete="off"
            value={tagInput}
            onChange={(event) => {
              const value = event.target.value
              if (value.includes(',')) {
                const parts = value.split(',')
                const remainder = parts.pop() ?? ''
                commitTagField(parts.join(','), remainder)
                return
              }
              tagInputRef.current = value
              setTagInput(value)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ',') return
              event.preventDefault()
              commitTagField(tagInputRef.current)
            }}
            onBlur={() => {
              if (!tagInputRef.current.trim()) return
              commitTagField(tagInputRef.current)
            }}
          />
        </div>
      </label>
      <label className="field">
        <span className="field-label">Style</span>
        <textarea
          className="field-input"
          aria-label="Style"
          value={draft.stylePrompt}
          spellCheck={false}
          onChange={(event) => patchDraft({ stylePrompt: event.target.value })}
        />
      </label>
      <label className="field">
        <span className="field-label">Lyrics</span>
        <textarea
          className="field-input"
          aria-label="Lyrics"
          value={draft.lyrics}
          onChange={(event) => patchDraft({ lyrics: event.target.value })}
        />
      </label>
      <label className="field">
        <span className="field-label">Notizen</span>
        <textarea
          className="field-input field-notes"
          aria-label="Notizen"
          value={draft.notes}
          onChange={(event) => patchDraft({ notes: event.target.value })}
        />
      </label>
      {confirmOpen ? (
        <ConfirmDialog
          message="Eintrag wirklich löschen?"
          confirmLabel="Löschen"
          cancelLabel="Abbrechen"
          danger
          onConfirm={() => {
            setConfirmOpen(false)
            void runStructural(onDeleteRef.current)
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      ) : null}
    </div>
  )
})
