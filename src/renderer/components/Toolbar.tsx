import type { RefObject } from 'react'
import type { LibraryFacet, SortMode } from '@shared/types'

interface ToolbarProps {
  search: string
  facet: LibraryFacet
  sort: SortMode
  tags: string[]
  notice: string | null
  busy: boolean
  onSearch: (value: string) => void
  onFacet: (facet: LibraryFacet) => void
  onSort: (sort: SortMode) => void
  onCreate: () => void
  onImport: () => void
  onExport: () => void
  searchRef: RefObject<HTMLInputElement>
}

export function Toolbar({
  search,
  facet,
  sort,
  tags,
  notice,
  busy,
  onSearch,
  onFacet,
  onSort,
  onCreate,
  onImport,
  onExport,
  searchRef,
}: ToolbarProps): JSX.Element {
  const facetValue =
    facet === 'rated' ? 'rated' : facet === 'published' ? 'published' : 'all'
  const tagValue = typeof facet === 'object' ? facet.tag : ''
  const tagKnown = tags.some(
    (tag) => tag.toLocaleLowerCase('de') === tagValue.toLocaleLowerCase('de'),
  )
  const knownTags = tagValue && !tagKnown ? [tagValue, ...tags] : tags

  return (
    <header className="toolbar">
      <div className="toolbar-row">
        <div className="toolbar-filters">
          <input
            ref={searchRef}
            className="search"
            type="search"
            placeholder="Suchen…"
            aria-label="Suche"
            autoComplete="off"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
          <select
            aria-label="Filter"
            value={facetValue}
            onChange={(event) => {
              const value = event.target.value
              if (value === 'rated') onFacet('rated')
              else if (value === 'published') onFacet('published')
              else onFacet('all')
            }}
          >
            <option value="all">Alle</option>
            <option value="rated">Mit Sternen</option>
            <option value="published">Veröffentlicht</option>
          </select>
          <select
            aria-label="Tag"
            value={tagValue}
            onChange={(event) => {
              const tag = event.target.value
              onFacet(tag ? { tag } : 'all')
            }}
          >
            <option value="">Alle Tags</option>
            {knownTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
          <select
            aria-label="Sortierung"
            value={sort}
            onChange={(event) => onSort(event.target.value as SortMode)}
          >
            <option value="newest">Neueste</option>
            <option value="title">A–Z</option>
            <option value="updated">Zuletzt geändert</option>
          </select>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onCreate}>
            Neu
          </button>
          <button type="button" className="btn" disabled={busy} onClick={onImport}>
            Import
          </button>
          <button type="button" className="btn" disabled={busy} onClick={onExport}>
            Bibliothek sichern
          </button>
        </div>
      </div>
      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
    </header>
  )
}
