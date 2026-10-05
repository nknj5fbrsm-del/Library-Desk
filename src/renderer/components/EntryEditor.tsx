import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  formatCopyBoth,
  formatCopyLyrics,
  formatCopyStyle,
} from '@shared/copyFormat'
import type { UpdateEntryPatch } from '@shared/deskApi'
import { applyExternalEntry, sameEditorDraft } from '@shared/editorDraft'
import type { Entry, PublishLink, StarRating } from '@shared/types'
import { normalizePublishLinks } from '@shared/types'
import { getDesk } from '@renderer/api'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { CoverPanel } from '@renderer/components/CoverThumb'
import { MiniPlayer } from '@renderer/components/MiniPlayer'
import { StarRatingInput } from '@renderer/components/StarRating'

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
  rating: StarRating
  published: boolean
  publishLinks: PublishLink[]
}

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'
type CopyPart = 'style' | 'lyrics' | 'both'

export interface EditorHandle {
  flush: () => Promise<void>
  copyStyle: () => Promise<void>
  copyLyrics: () => Promise<void>
  copyBoth: () => Promise<void>
  requestDelete: () => void
  undo: () => boolean
  redo: () => boolean
}

interface EntryEditorProps {
  entry: Entry
  siblings: Entry[]
  busy: boolean
  onUpdate: (id: string, patch: UpdateEntryPatch) => Promise<Entry>
  onDuplicate: (id: string) => Promise<void>
  onCreateVersion: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onSelectVersion: (id: string) => void
  onAudioChange: (entry: Entry) => void
  onCoverChange: (entry: Entry) => void
}

function audioActionError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : ''
  if (message === 'Audio URL is empty') return 'Bitte eine Audio-URL eingeben.'
  if (message.startsWith('Entry not found')) return 'Eintrag nicht gefunden.'
  return 'Audio konnte nicht gespeichert werden.'
}

function AudioPanel({
  entry,
  onAudioChange,
}: {
  entry: Entry
  onAudioChange: (entry: Entry) => void
}): JSX.Element {
  const [open, setOpen] = useState(() => entry.audio != null)
  const [urlDraft, setUrlDraft] = useState('')
  const [audioBusy, setAudioBusy] = useState(false)
  const [audioNote, setAudioNote] = useState<string | null>(null)
  const [playbackSrc, setPlaybackSrc] = useState<string | null>(null)
  const [missingFile, setMissingFile] = useState(false)
  const entryIdRef = useRef(entry.id)
  const onAudioChangeRef = useRef(onAudioChange)
  const urlDraftRef = useRef('')
  const audioBusyRef = useRef(false)
  entryIdRef.current = entry.id
  onAudioChangeRef.current = onAudioChange

  const sourceLabel =
    entry.audio?.kind === 'local'
      ? entry.audio.originalName
      : entry.audio?.kind === 'url'
        ? entry.audio.href
        : null

  useEffect(() => {
    const audio = entry.audio
    if (!audio) {
      setPlaybackSrc(null)
      setMissingFile(false)
      return
    }
    if (audio.kind === 'url') {
      setPlaybackSrc(audio.href)
      setMissingFile(false)
      return
    }
    let cancelled = false
    setPlaybackSrc(null)
    setMissingFile(false)
    getDesk()
      .audio.resolveLocalUrl(entry.id)
      .then((url) => {
        if (cancelled) return
        if (!url) {
          setMissingFile(true)
          setPlaybackSrc(null)
          return
        }
        setMissingFile(false)
        setPlaybackSrc(url)
      })
      .catch(() => {
        if (cancelled) return
        setMissingFile(true)
        setPlaybackSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [entry.id, entry.audio])

  function writeUrlDraft(value: string): void {
    urlDraftRef.current = value
    setUrlDraft(value)
  }

  async function runAudio(action: () => Promise<Entry | null>): Promise<boolean> {
    if (audioBusyRef.current) return false
    audioBusyRef.current = true
    setAudioBusy(true)
    setAudioNote(null)
    try {
      const updated = await action()
      if (!updated) return false
      if (entryIdRef.current === updated.id) onAudioChangeRef.current(updated)
      return true
    } catch (cause) {
      setAudioNote(audioActionError(cause))
      return false
    } finally {
      audioBusyRef.current = false
      setAudioBusy(false)
    }
  }

  async function submitUrl(): Promise<void> {
    const href = urlDraftRef.current.trim()
    if (!href) {
      setAudioNote('Bitte eine Audio-URL eingeben.')
      return
    }
    const saved = await runAudio(() => getDesk().audio.setUrl(entryIdRef.current, href))
    if (saved && urlDraftRef.current.trim() === href) writeUrlDraft('')
  }

  return (
    <section className="editor-accordion" aria-label="Audio">
      <button
        type="button"
        className={open ? 'btn editor-accordion-toggle is-open' : 'btn editor-accordion-toggle'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Audio{entry.audio ? ' · gesetzt' : ''}
      </button>
      {open ? (
        <div className="editor-accordion-body">
          <div className="editor-actions-row">
            <button
              type="button"
              className="btn"
              disabled={audioBusy}
              onClick={() => void runAudio(() => getDesk().audio.attachLocal(entryIdRef.current))}
            >
              Lokale Datei…
            </button>
            <input
              className="editor-url"
              aria-label="Audio-URL"
              placeholder="https://"
              autoComplete="off"
              spellCheck={false}
              value={urlDraft}
              onChange={(event) => writeUrlDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                void submitUrl()
              }}
            />
            <button type="button" className="btn" disabled={audioBusy} onClick={() => void submitUrl()}>
              URL setzen
            </button>
            {entry.audio ? (
              <button
                type="button"
                className="btn"
                disabled={audioBusy}
                onClick={() => void runAudio(() => getDesk().audio.clear(entryIdRef.current))}
              >
                Entfernen
              </button>
            ) : null}
          </div>
          {sourceLabel ? <p className="audio-source">{sourceLabel}</p> : null}
          {missingFile ? (
            <p className="audio-missing" role="alert">
              Audiodatei fehlt — bitte neu anhängen
            </p>
          ) : null}
          {audioNote ? (
            <p className="audio-missing" role="alert">
              {audioNote}
            </p>
          ) : null}
        </div>
      ) : null}
      {playbackSrc ? (
        <MiniPlayer
          src={playbackSrc}
          openExternalHref={entry.audio?.kind === 'url' ? entry.audio.href : null}
        />
      ) : null}
    </section>
  )
}

function toDraft(entry: Entry): Draft {
  return {
    title: entry.title,
    stylePrompt: entry.stylePrompt,
    lyrics: entry.lyrics,
    notes: entry.notes,
    tags: [...entry.tags],
    rating: entry.rating,
    published: entry.published,
    publishLinks: entry.publishLinks.map((link) => ({ ...link })),
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
  {
    entry,
    siblings,
    busy,
    onUpdate,
    onDuplicate,
    onCreateVersion,
    onDelete,
    onSelectVersion,
    onAudioChange,
    onCoverChange,
  },
  ref,
): JSX.Element {
  const [draft, setDraft] = useState<Draft>(() => toDraft(entry))
  const [tagInput, setTagInput] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [copyNote, setCopyNote] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(() => entry.published)

  const draftRef = useRef(draft)
  const tagInputRef = useRef('')
  const entryIdRef = useRef(entry.id)
  const dirtyRef = useRef(false)
  const savingRef = useRef(false)
  const actingRef = useRef(false)
  const mountedRef = useRef(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const undoStackRef = useRef<Draft[]>([])
  const redoStackRef = useRef<Draft[]>([])
  const onUpdateRef = useRef(onUpdate)
  const onDuplicateRef = useRef(onDuplicate)
  const onCreateVersionRef = useRef(onCreateVersion)
  const onDeleteRef = useRef(onDelete)
  const flushRef = useRef<() => Promise<void>>(async () => undefined)
  const copyRef = useRef<(part: CopyPart) => Promise<void>>(async () => undefined)
  const undoRef = useRef<() => boolean>(() => false)
  const redoRef = useRef<() => boolean>(() => false)

  entryIdRef.current = entry.id
  onUpdateRef.current = onUpdate
  onDuplicateRef.current = onDuplicate
  onCreateVersionRef.current = onCreateVersion
  onDeleteRef.current = onDelete

  function cloneDraft(value: Draft): Draft {
    return {
      ...value,
      tags: [...value.tags],
      publishLinks: value.publishLinks.map((link) => ({ ...link })),
    }
  }

  function pushUndoSnapshot(previous: Draft): void {
    undoStackRef.current.push(cloneDraft(previous))
    if (undoStackRef.current.length > 40) undoStackRef.current.shift()
    redoStackRef.current = []
  }

  function applyDraft(next: Draft, markDirty: boolean, recordHistory = false): void {
    if (recordHistory && !sameEditorDraft(draftRef.current, next)) {
      pushUndoSnapshot(draftRef.current)
    }
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

  function patchDraft(partial: Partial<Draft>, recordHistory = false): void {
    applyDraft({ ...draftRef.current, ...partial }, true, recordHistory)
  }

  function restoreDraft(next: Draft): void {
    draftRef.current = next
    setDraft(next)
    dirtyRef.current = true
    setSaveState('pending')
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      void flushRef.current()
    }, SAVE_DELAY_MS)
  }

  function undoDraft(): boolean {
    const previous = undoStackRef.current.pop()
    if (!previous) return false
    redoStackRef.current.push(cloneDraft(draftRef.current))
    restoreDraft(previous)
    return true
  }

  function redoDraft(): boolean {
    const next = redoStackRef.current.pop()
    if (!next) return false
    undoStackRef.current.push(cloneDraft(draftRef.current))
    restoreDraft(next)
    return true
  }

  function absorbTagInput(): void {
    const raw = tagInputRef.current
    if (!raw.trim()) return
    const next = mergeTags(draftRef.current, raw)
    tagInputRef.current = ''
    setTagInput('')
    if (next === draftRef.current) return
    applyDraft(next, true, true)
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
      rating: sent.rating,
      published: sent.published,
      publishLinks: normalizePublishLinks(sent.publishLinks),
    }
    if (mountedRef.current) setSaveState('saving')
    savingRef.current = true
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
    } finally {
      savingRef.current = false
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
  undoRef.current = undoDraft
  redoRef.current = redoDraft

  useImperativeHandle(
    ref,
    () => ({
      flush: () => flushRef.current(),
      copyStyle: () => copyRef.current('style'),
      copyLyrics: () => copyRef.current('lyrics'),
      copyBoth: () => copyRef.current('both'),
      requestDelete: () => setConfirmOpen(true),
      undo: () => undoRef.current(),
      redo: () => redoRef.current(),
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

  useEffect(() => {
    const next = applyExternalEntry(
      draftRef.current,
      toDraft(entry),
      dirtyRef.current || savingRef.current,
    )
    if (next === draftRef.current) return
    draftRef.current = next
    setDraft(next)
  }, [entry])

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
    if (next !== draftRef.current) applyDraft(next, true, true)
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
        <CoverPanel entry={entry} busy={busy} onChange={onCoverChange} />
        <div className="editor-head-main">
          <input
            className="title-input"
            aria-label="Titel"
            value={draft.title}
            placeholder="Ohne Titel"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => patchDraft({ title: event.target.value })}
          />
          <StarRatingInput
            value={draft.rating}
            onChange={(rating) => patchDraft({ rating }, true)}
          />
        </div>
      </div>
      <div className="version-bar" aria-label="Versionen">
        <span className="version-bar-label">Versionen</span>
        <div className="version-chips">
          {siblings.map((sibling) => (
            <button
              key={sibling.id}
              type="button"
              className={sibling.id === entry.id ? 'version-chip is-active' : 'version-chip'}
              aria-pressed={sibling.id === entry.id}
              onClick={() => {
                if (sibling.id === entry.id) return
                void (async () => {
                  try {
                    await flushRef.current()
                  } catch {
                    return
                  }
                  onSelectVersion(sibling.id)
                })()
              }}
            >
              V{sibling.version}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void runStructural(onCreateVersionRef.current)}
        >
          + Version
        </button>
      </div>
      <p className="meta">
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
      <AudioPanel entry={entry} onAudioChange={onAudioChange} />
      <section className="editor-accordion" aria-label="Veröffentlicht">
        <button
          type="button"
          className={
            publishOpen ? 'btn editor-accordion-toggle is-open' : 'btn editor-accordion-toggle'
          }
          aria-expanded={publishOpen}
          onClick={() => {
            if (publishOpen) {
              setPublishOpen(false)
              return
            }
            setPublishOpen(true)
            const current = draftRef.current
            if (!current.published || current.publishLinks.length === 0) {
              patchDraft(
                {
                  published: true,
                  publishLinks:
                    current.publishLinks.length > 0
                      ? current.publishLinks
                      : [{ id: crypto.randomUUID(), label: '', href: '' }],
                },
                true,
              )
            }
          }}
        >
          Veröffentlicht{draft.published ? ' · aktiv' : ''}
        </button>
        {publishOpen ? (
          <div className="editor-accordion-body">
            {draft.publishLinks.map((link) => (
              <div key={link.id} className="editor-actions-row">
                <input
                  className="publish-label"
                  aria-label="Link-Label"
                  placeholder="YouTube, Spotify…"
                  autoComplete="off"
                  value={link.label}
                  onChange={(event) => {
                    const label = event.target.value
                    patchDraft(
                      {
                        publishLinks: draftRef.current.publishLinks.map((item) =>
                          item.id === link.id ? { ...item, label } : item,
                        ),
                      },
                      true,
                    )
                  }}
                />
                <input
                  className="editor-url"
                  aria-label="Link-URL"
                  placeholder="https://"
                  autoComplete="off"
                  spellCheck={false}
                  value={link.href}
                  onChange={(event) => {
                    const href = event.target.value
                    patchDraft(
                      {
                        publishLinks: draftRef.current.publishLinks.map((item) =>
                          item.id === link.id ? { ...item, href } : item,
                        ),
                      },
                      true,
                    )
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  disabled={!link.href.trim()}
                  onClick={() => void getDesk().shell.openExternal(link.href.trim())}
                >
                  Öffnen
                </button>
                <button
                  type="button"
                  className="btn"
                  aria-label="Link entfernen"
                  onClick={() =>
                    patchDraft(
                      {
                        publishLinks: draftRef.current.publishLinks.filter(
                          (item) => item.id !== link.id,
                        ),
                      },
                      true,
                    )
                  }
                >
                  Entfernen
                </button>
              </div>
            ))}
            <div className="editor-actions-row">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  patchDraft(
                    {
                      publishLinks: [
                        ...draftRef.current.publishLinks,
                        { id: crypto.randomUUID(), label: '', href: '' },
                      ],
                    },
                    true,
                  )
                }
              >
                + Link
              </button>
              {draft.published ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setPublishOpen(false)
                    patchDraft({ published: false }, true)
                  }}
                >
                  Aufheben
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
      <div className="field">
        <span className="field-label" id="tags-label">
          Tags
        </span>
        <div className="tag-editor" role="group" aria-labelledby="tags-label">
          {draft.tags.map((tag) => (
            <span key={tag.toLocaleLowerCase('de')} className="tag-chip">
              <span className="tag-chip-label">{tag}</span>
              <button
                type="button"
                className="tag-remove"
                aria-label={`${tag} entfernen`}
                onMouseDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  patchDraft(
                    {
                      tags: draftRef.current.tags.filter((item) => item !== tag),
                    },
                    true,
                  )
                }}
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
      </div>
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
          message={
            siblings.length >= 2
              ? `Version ${entry.version} von „${entry.title}“ wirklich löschen?`
              : `Eintrag „${entry.title}“ wirklich löschen?`
          }
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
