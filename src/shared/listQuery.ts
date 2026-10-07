import type { ListQuery } from './deskApi'
import type { Entry } from './types'

function matchesSearch(entry: Entry, search: string): boolean {
  if (search.length === 0) return true
  const haystack = [
    entry.title,
    entry.stylePrompt,
    entry.lyrics,
    entry.notes,
    entry.tags.join(' '),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(search)
}

function matchesFacet(entry: Entry, facet: ListQuery['facet']): boolean {
  if (facet === 'all') return true
  if (facet === 'rated') return entry.rating >= 1
  if (facet === 'published') return entry.published === true
  const tag = facet.tag.trim().toLowerCase()
  if (tag.length === 0) return true
  return entry.tags.some((t) => t.toLowerCase() === tag)
}

function compareEntries(a: Entry, b: Entry, sort: ListQuery['sort']): number {
  if (sort === 'title') {
    const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    if (byTitle !== 0) return byTitle
    return a.id.localeCompare(b.id)
  }
  if (sort === 'updated') {
    if (a.updatedAt !== b.updatedAt) return b.updatedAt - a.updatedAt
    return a.id.localeCompare(b.id)
  }
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt
  return a.id.localeCompare(b.id)
}

/** Pure list filter/sort matching Electron `listEntries` semantics (JS side). */
export function filterAndSortEntries(entries: Entry[], query: ListQuery): Entry[] {
  const search = query.search.trim().toLowerCase()
  return entries
    .filter((entry) => matchesSearch(entry, search) && matchesFacet(entry, query.facet))
    .slice()
    .sort((a, b) => compareEntries(a, b, query.sort))
}
