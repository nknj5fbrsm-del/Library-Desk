import { LibraryList } from '@renderer/components/LibraryList'
import { Toolbar } from '@renderer/components/Toolbar'
import { useLibrary } from '@renderer/hooks/useLibrary'

export default function App(): JSX.Element {
  const library = useLibrary()
  const filtered =
    library.query.search.trim().length > 0 || library.query.facet !== 'all'
  const selectedVisible = library.entries.some((entry) => entry.id === library.selectedId)

  return (
    <div className="app">
      <Toolbar
        search={library.query.search}
        facet={library.query.facet}
        sort={library.query.sort}
        tags={library.tags}
        notice={library.notice}
        busy={library.busy}
        onSearch={library.setSearch}
        onFacet={library.setFacet}
        onSort={library.setSort}
        onCreate={() => void library.createNew()}
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
              <h1>{library.selectedEntry.title}</h1>
              <p className="meta">Version {library.selectedEntry.version}</p>
              {!selectedVisible ? (
                <p className="muted">Im aktuellen Filter nicht sichtbar.</p>
              ) : null}
            </>
          ) : (
            <p className="muted">Kein Eintrag ausgewählt.</p>
          )}
        </section>
      </div>
    </div>
  )
}
