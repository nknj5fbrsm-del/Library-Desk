import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { getDesk } from '@renderer/api'
import { AutoBackupDialog } from '@renderer/components/AutoBackupDialog'
import { ConfirmDialog } from '@renderer/components/ConfirmDialog'
import { EntryEditor, type EditorHandle } from '@renderer/components/EntryEditor'
import { LibraryList } from '@renderer/components/LibraryList'
import { NewKindDialog } from '@renderer/components/NewKindDialog'
import { Toolbar } from '@renderer/components/Toolbar'
import type { EntryKind } from '@shared/types'
import { useCoverAmbienceLayers } from '@renderer/hooks/useCoverAmbience'
import { useLibrary } from '@renderer/hooks/useLibrary'
import { useIsMobile } from '@renderer/hooks/useMobileLayout'
import { hydrateVolume } from '@renderer/hooks/useMiniPlayer'
import type { Entry } from '@shared/types'

const SPLIT_SETTING_KEY = 'splitListWidth'
const SPLIT_DEFAULT = 360
const SPLIT_MIN = 200
const SPLIT_MAX_RATIO = 0.7

type MobilePane = 'list' | 'detail'

interface DeskHistoryState {
  libraryDeskPane?: MobilePane
}

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

function readHistoryPane(): MobilePane | null {
  const state = window.history.state as DeskHistoryState | null
  return state?.libraryDeskPane === 'detail' || state?.libraryDeskPane === 'list'
    ? state.libraryDeskPane
    : null
}

export default function App(): JSX.Element {
  const library = useLibrary()
  const isMobile = useIsMobile()
  const searchRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<EditorHandle>(null)
  const splitRef = useRef<HTMLDivElement>(null)
  const listWidthRef = useRef(SPLIT_DEFAULT)
  const selectedIdRef = useRef(library.selectedId)
  const isMobileRef = useRef(isMobile)
  const wasMobileRef = useRef(isMobile)
  selectedIdRef.current = library.selectedId
  isMobileRef.current = isMobile

  const [listWidth, setListWidth] = useState(SPLIT_DEFAULT)
  const [dragging, setDragging] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Entry | null>(null)
  const [mobilePane, setMobilePane] = useState<MobilePane>('list')
  const [newKindOpen, setNewKindOpen] = useState(false)
  const [autoBackupOpen, setAutoBackupOpen] = useState(false)
  const [autoBackupAvailable, setAutoBackupAvailable] = useState(false)
  listWidthRef.current = listWidth
  const coverAmbience = useCoverAmbienceLayers(library.selectedEntry)

  const filtered =
    library.query.search.trim().length > 0 ||
    library.query.facet !== 'all' ||
    library.query.kind !== 'all'

  async function createOfKind(kind: EntryKind): Promise<void> {
    try {
      await editorRef.current?.flush()
    } catch {
      return
    }
    await library.createNew(kind)
    if (isMobileRef.current) showDetailPane(true)
  }
  const selectedVisible = library.entries.some((entry) => entry.id === library.selectedId)

  function showDetailPane(pushHistory: boolean): void {
    setMobilePane('detail')
    if (!isMobileRef.current || !pushHistory) return
    if (readHistoryPane() === 'detail') return
    window.history.pushState({ libraryDeskPane: 'detail' } satisfies DeskHistoryState, '')
  }

  function showListPane(fromButton: boolean): void {
    if (fromButton && readHistoryPane() === 'detail') {
      window.history.back()
      return
    }
    setMobilePane('list')
  }

  useEffect(() => {
    void hydrateVolume()
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const available = await getDesk().autoBackup.isAvailable()
        if (!cancelled) setAutoBackupAvailable(available)
      } catch {
        if (!cancelled) setAutoBackupAvailable(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return getDesk().autoBackup.onNotice((payload) => {
      library.showNotice(payload.message)
    })
  }, [library.showNotice])

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
    if (isMobile && !wasMobileRef.current) {
      setMobilePane(selectedIdRef.current ? 'detail' : 'list')
    }
    wasMobileRef.current = isMobile
  }, [isMobile])

  useEffect(() => {
    function onPopState(): void {
      if (!isMobileRef.current) return
      const pane = readHistoryPane()
      setMobilePane(pane === 'detail' && selectedIdRef.current ? 'detail' : 'list')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
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
        setNewKindOpen(true)
        return
      }

      if (meta && key === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }

      if (event.key === 'Escape' && isMobileRef.current && mobilePane === 'detail') {
        if (isTextField(document.activeElement)) return
        if (document.querySelector('[role="dialog"]')) return
        event.preventDefault()
        showListPane(true)
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
  }, [mobilePane])

  function persistListWidth(width: number): void {
    void getDesk()
      .settings.set(SPLIT_SETTING_KEY, String(width))
      .catch(() => undefined)
  }

  function onSplitterPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (isMobile || event.button !== 0) return
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

  const isWebDesk = import.meta.env.VITE_DESK_WEB === 'true'
  const appClass = [
    'app',
    dragging ? 'is-splitting' : '',
    isMobile ? 'is-mobile' : '',
    isMobile ? (mobilePane === 'detail' ? 'is-detail-pane' : 'is-list-pane') : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={appClass}>
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
      {isWebDesk ? (
        <div className="web-persist-banner" role="note">
          Daten bleiben in diesem Browser — Bibliothek sichern empfohlen.
        </div>
      ) : null}
      <Toolbar
        search={library.query.search}
        facet={library.query.facet}
        kind={library.query.kind}
        sort={library.query.sort}
        tags={library.tags}
        notice={library.notice}
        busy={library.busy}
        searchRef={searchRef}
        onSearch={library.setSearch}
        onFacet={library.setFacet}
        onKind={library.setKind}
        onSort={library.setSort}
        onCreate={() => setNewKindOpen(true)}
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
        onAutoBackup={autoBackupAvailable ? () => setAutoBackupOpen(true) : undefined}
      />
      {autoBackupOpen ? (
        <AutoBackupDialog
          onClose={() => setAutoBackupOpen(false)}
          onNotice={(message) => library.showNotice(message)}
        />
      ) : null}
      <div
        className="split"
        ref={splitRef}
        style={
          isMobile
            ? undefined
            : { gridTemplateColumns: `${listWidth}px 6px minmax(0, 1fr)` }
        }
      >
        <LibraryList
          entries={library.entries}
          selectedId={library.selectedId}
          loading={library.loading}
          error={library.error}
          filtered={filtered}
          busy={library.busy}
          onSelect={(id) => {
            library.select(id)
            if (isMobileRef.current) showDetailPane(true)
          }}
          onDelete={(entry) => setPendingDelete(entry)}
        />
        <div
          className="split-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Listenbreite"
          aria-valuenow={listWidth}
          aria-valuemin={SPLIT_MIN}
          aria-hidden={isMobile || undefined}
          tabIndex={isMobile ? -1 : 0}
          onPointerDown={onSplitterPointerDown}
          onKeyDown={(event) => {
            if (isMobile) return
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
          {isMobile && mobilePane === 'detail' ? (
            <div className="mobile-detail-bar">
              <button
                type="button"
                className="btn mobile-back"
                onClick={() => showListPane(true)}
              >
                ← Bibliothek
              </button>
            </div>
          ) : null}
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
                onDelete={async (id) => {
                  await library.deleteEntry(id)
                  if (isMobileRef.current) showListPane(false)
                }}
                onExportEntry={library.exportEntry}
                onSelectVersion={library.select}
                onAudioChange={library.syncEntry}
                onCoverChange={library.syncEntry}
                onAttachmentsChange={library.syncEntry}
              />
            </>
          ) : (
            <p className="muted">Kein Eintrag ausgewählt.</p>
          )}
        </section>
      </div>
      {newKindOpen ? (
        <NewKindDialog
          onPick={(kind) => {
            setNewKindOpen(false)
            void createOfKind(kind)
          }}
          onCancel={() => setNewKindOpen(false)}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          message={
            library.catalog.filter((entry) => entry.groupId === pendingDelete.groupId).length >= 2
              ? `Version ${pendingDelete.version} von „${pendingDelete.title}“ wirklich löschen?`
              : `Eintrag „${pendingDelete.title}“ wirklich löschen?`
          }
          confirmLabel="Löschen"
          cancelLabel="Abbrechen"
          danger
          onConfirm={() => {
            const target = pendingDelete
            setPendingDelete(null)
            void (async () => {
              try {
                if (library.selectedId === target.id) {
                  await editorRef.current?.flush()
                }
              } catch {
                return
              }
              await library.deleteEntry(target.id)
              if (isMobileRef.current) showListPane(false)
            })()
          }}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  )
}
