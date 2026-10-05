import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { getDesk } from '@renderer/api'
import { EntryEditor, type EditorHandle } from '@renderer/components/EntryEditor'
import { LibraryList } from '@renderer/components/LibraryList'
import { Toolbar } from '@renderer/components/Toolbar'
import { useCoverAmbienceLayers } from '@renderer/hooks/useCoverAmbience'
import { useLibrary } from '@renderer/hooks/useLibrary'
import { hydrateVolume } from '@renderer/hooks/useMiniPlayer'

const SPLIT_SETTING_KEY = 'splitListWidth'
const SPLIT_DEFAULT = 360
const SPLIT_MIN = 200
const SPLIT_MAX_RATIO = 0.7

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

function clampListWidth(width: number, containerWidth: number): number {
  if (containerWidth <= 0) return Math.max(SPLIT_MIN, Math.round(width))
  const max = Math.max(SPLIT_MIN, Math.floor(containerWidth * SPLIT_MAX_RATIO))
  return Math.min(max, Math.max(SPLIT_MIN, Math.round(width)))
}

function parseStoredWidth(raw: string | null): number | null {
  if (raw == null) return null
  const value = Number(raw)
  if (!Number.isFinite(value)) return null
  return Math.round(value)
}

export default function App(): JSX.Element {
  const library = useLibrary()
  const searchRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<EditorHandle>(null)
  const splitRef = useRef<HTMLDivElement>(null)
  const listWidthRef = useRef(SPLIT_DEFAULT)
  const selectedIdRef = useRef(library.selectedId)
  const createNewRef = useRef(library.createNew)
  selectedIdRef.current = library.selectedId
  createNewRef.current = library.createNew

  const [listWidth, setListWidth] = useState(SPLIT_DEFAULT)
  const [dragging, setDragging] = useState(false)
  listWidthRef.current = listWidth
  const coverAmbience = useCoverAmbienceLayers(library.selectedEntry)

  const filtered =
    library.query.search.trim().length > 0 || library.query.facet !== 'all'
  const selectedVisible = library.entries.some((entry) => entry.id === library.selectedId)

  useEffect(() => {
    void hydrateVolume()
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const stored = parseStoredWidth(await getDesk().settings.get(SPLIT_SETTING_KEY))
        if (cancelled || stored == null) return
        const container = splitRef.current?.clientWidth ?? 0
        setListWidth(clampListWidth(stored, container))
      } catch {
        // Default-Breite bleibt.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onResize(): void {
      const container = splitRef.current?.clientWidth ?? 0
      setListWidth((current) => clampListWidth(current, container))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const desk = getDesk()
    const offUndo = desk.edit.onUndo(() => {
      if (editorRef.current?.undo()) return
      document.execCommand('undo')
    })
    const offRedo = desk.edit.onRedo(() => {
      if (editorRef.current?.redo()) return
      document.execCommand('redo')
    })
    return () => {
      offUndo()
      offRedo()
    }
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.repeat || event.altKey) return
      const meta = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()

      if (meta && event.shiftKey && key === 'c') {
        if (!selectedIdRef.current) return
        event.preventDefault()
        void editorRef.current?.copyBoth()
        return
      }

      if (meta && !event.shiftKey && key === 's') {
        event.preventDefault()
        void editorRef.current?.flush().catch(() => undefined)
        return
      }

      if (meta && event.shiftKey) return

      if (meta && key === 'n') {
        event.preventDefault()
        void (async () => {
          try {
            await editorRef.current?.flush()
          } catch {
            return
          }
          await createNewRef.current()
        })()
        return
      }

      if (meta && key === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }

      const deleteShortcut = event.key === 'Delete' || (meta && event.key === 'Backspace')
      if (!deleteShortcut || !selectedIdRef.current) return
      if (isTextField(document.activeElement)) return
      if (document.querySelector('[role="dialog"]')) return
      event.preventDefault()
      editorRef.current?.requestDelete()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function persistListWidth(width: number): void {
    void getDesk()
      .settings.set(SPLIT_SETTING_KEY, String(width))
      .catch(() => undefined)
  }

  function onSplitterPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    const split = splitRef.current
    if (!split) return
    const splitLeft = split.getBoundingClientRect().left
    handle.setPointerCapture(event.pointerId)
    setDragging(true)

    function onMove(moveEvent: PointerEvent): void {
      const next = clampListWidth(moveEvent.clientX - splitLeft, split.clientWidth)
      listWidthRef.current = next
      setListWidth(next)
    }

    function onUp(upEvent: PointerEvent): void {
      handle.releasePointerCapture(upEvent.pointerId)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      setDragging(false)
      persistListWidth(listWidthRef.current)
    }

    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  return (
    <div className={dragging ? 'app is-splitting' : 'app'}>
      <div
        className={
          coverAmbience.frontActive ? 'app-ambience is-active' : 'app-ambience'
        }
        style={{ '--cover-ambience': coverAmbience.front } as CSSProperties}
        aria-hidden="true"
      />
      <div
        className={
          coverAmbience.frontActive ? 'app-ambience' : 'app-ambience is-active'
        }
        style={{ '--cover-ambience': coverAmbience.back } as CSSProperties}
        aria-hidden="true"
      />
      <Toolbar
        search={library.query.search}
        facet={library.query.facet}
        sort={library.query.sort}
        tags={library.tags}
        notice={library.notice}
        busy={library.busy}
        searchRef={searchRef}
        onSearch={library.setSearch}
        onFacet={library.setFacet}
        onSort={library.setSort}
        onCreate={() => {
          void (async () => {
            try {
              await editorRef.current?.flush()
            } catch {
              return
            }
            await library.createNew()
          })()
        }}
        onImport={() => {
          void (async () => {
            try {
              await editorRef.current?.flush()
            } catch {
              return
            }
            await library.importLibrary()
          })()
        }}
        onExport={() => {
          void (async () => {
            try {
              await editorRef.current?.flush()
            } catch {
              return
            }
            await library.exportLibrary()
          })()
        }}
      />
      <div
        className="split"
        ref={splitRef}
        style={{ gridTemplateColumns: `${listWidth}px 6px minmax(0, 1fr)` }}
      >
        <LibraryList
          entries={library.entries}
          selectedId={library.selectedId}
          loading={library.loading}
          error={library.error}
          filtered={filtered}
          onSelect={library.select}
        />
        <div
          className="split-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Listenbreite"
          aria-valuenow={listWidth}
          aria-valuemin={SPLIT_MIN}
          tabIndex={0}
          onPointerDown={onSplitterPointerDown}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            const delta = event.key === 'ArrowLeft' ? -16 : 16
            const container = splitRef.current?.clientWidth ?? 0
            const next = clampListWidth(listWidthRef.current + delta, container)
            listWidthRef.current = next
            setListWidth(next)
            persistListWidth(next)
          }}
        />
        <section className="detail" aria-label="Detail">
          {library.selectedEntry ? (
            <>
              {!selectedVisible ? (
                <p className="muted">Im aktuellen Filter nicht sichtbar.</p>
              ) : null}
              <EntryEditor
                key={`${library.selectedEntry.id}:${library.editorRevision}`}
                ref={editorRef}
                entry={library.selectedEntry}
                siblings={library.versionSiblings}
                busy={library.busy}
                onUpdate={library.updateEntry}
                onDuplicate={library.duplicateEntry}
                onCreateVersion={library.createVersion}
                onDelete={library.deleteEntry}
                onSelectVersion={library.select}
                onAudioChange={library.syncEntry}
                onCoverChange={library.syncEntry}
              />
            </>
          ) : (
            <p className="muted">Kein Eintrag ausgewählt.</p>
          )}
        </section>
      </div>
    </div>
  )
}
