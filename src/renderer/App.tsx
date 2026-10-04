import { useEffect, useRef } from 'react'
import { EntryEditor, type EditorHandle } from '@renderer/components/EntryEditor'
import { LibraryList } from '@renderer/components/LibraryList'
import { Toolbar } from '@renderer/components/Toolbar'
import { useLibrary } from '@renderer/hooks/useLibrary'
import { hydrateVolume } from '@renderer/hooks/useMiniPlayer'

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export default function App(): JSX.Element {
  const library = useLibrary()
  const searchRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<EditorHandle>(null)
  const selectedIdRef = useRef(library.selectedId)
  const createNewRef = useRef(library.createNew)
  selectedIdRef.current = library.selectedId
  createNewRef.current = library.createNew

  const filtered =
    library.query.search.trim().length > 0 || library.query.facet !== 'all'
  const selectedVisible = library.entries.some((entry) => entry.id === library.selectedId)

  useEffect(() => {
    void hydrateVolume()
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

  return (
    <div className="app">
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
        onImport={() => void library.importLibrary()}
        onExport={() => void library.exportLibrary()}
      />
      <div className="split">
        <LibraryList
          entries={library.entries}
          selectedId={library.selectedId}
          loading={library.loading}
          error={library.error}
          filtered={filtered}
          onSelect={library.select}
        />
        <section className="detail" aria-label="Detail">
          {library.selectedEntry ? (
            <>
              {!selectedVisible ? (
                <p className="muted">Im aktuellen Filter nicht sichtbar.</p>
              ) : null}
              <EntryEditor
                key={library.selectedEntry.id}
                ref={editorRef}
                entry={library.selectedEntry}
                busy={library.busy}
                onUpdate={library.updateEntry}
                onDuplicate={library.duplicateEntry}
                onCreateVersion={library.createVersion}
                onDelete={library.deleteEntry}
                onAudioChange={library.syncEntry}
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
