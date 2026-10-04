import { useEffect, useRef } from 'react'
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
}: ToolbarProps): JSX.Element {
  const searchRef = useRef<HTMLInputElement>(null)
  const facetValue = facet === 'power' ? 'power' : 'all'
  const tagValue = typeof facet === 'object' ? facet.tag : ''
  const tagKnown = tags.some(
    (tag) => tag.toLocaleLowerCase('de') === tagValue.toLocaleLowerCase('de'),
  )
  const knownTags = tagValue && !tagKnown ? [tagValue, ...tags] : tags

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'n') {
        event.preventDefault()
        onCreate()
      } else if (key === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCreate])

  return (
    <header className="toolbar">
      <div className="toolbar-row">
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
          onChange={(event) => onFacet(event.target.value === 'power' ? 'power' : 'all')}
        >
          <option value="all">Alle</option>
          <option value="power">Power</option>
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
        <span className="toolbar-spacer" />
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onCreate}>
          Neu
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onImport}>
          Import
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onExport}>
          Export
        </button>
      </div>
      {notice ? (
        <p className="notice" role="status">
          {notice}
        </p>
      ) : null}
    </header>
  )
}
