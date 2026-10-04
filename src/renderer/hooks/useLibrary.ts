import { useCallback, useEffect, useRef, useState } from 'react'
import { getDesk } from '@renderer/api'
import type { ListQuery, UpdateEntryPatch } from '@shared/deskApi'
import type { Entry, LibraryFacet, SortMode } from '@shared/types'

function collectTags(entries: Entry[]): string[] {
  const byKey = new Map<string, string>()
  for (const entry of entries) {
    for (const tag of entry.tags) {
      const key = tag.toLocaleLowerCase('de')
      if (!byKey.has(key)) byKey.set(key, tag)
    }
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.localeCompare(b, 'de', { sensitivity: 'base' }),
  )
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Bibliothek konnte nicht geladen werden.'
}

function isSortMode(value: string | null): value is SortMode {
  return value === 'newest' || value === 'title' || value === 'updated'
}

export function useLibrary() {
  const [query, setQuery] = useState<ListQuery>({
    search: '',
    facet: 'all',
    sort: 'newest',
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [catalog, setCatalog] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [settingsReady, setSettingsReady] = useState(false)
  const [editorRevision, setEditorRevision] = useState(0)
  const requestId = useRef(0)
  const queryRef = useRef(query)
  const sortTouched = useRef(false)
  queryRef.current = query

  const load = useCallback(async (activeQuery: ListQuery, preferId?: string) => {
    const id = ++requestId.current
    const desk = getDesk()
    const [listed, all] = await Promise.all([
      desk.entries.list(activeQuery),
      desk.entries.list({ search: '', facet: 'all', sort: 'title' }),
    ])
    if (id !== requestId.current) return
    setEntries(listed)
    setCatalog(all)
    setSelectedId((current) => {
      const next = preferId ?? current
      if (next && all.some((entry) => entry.id === next)) return next
      return null
    })
    setError(null)
  }, [])

  const reload = useCallback(async () => {
    await load(queryRef.current)
  }, [load])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const stored = await getDesk().settings.get('sortMode')
        if (!cancelled && !sortTouched.current && isSortMode(stored)) {
          setQuery((current) => (current.sort === stored ? current : { ...current, sort: stored }))
        }
      } catch {
        // Default-Sortierung bleibt, die Bibliothek lädt trotzdem.
      } finally {
        if (!cancelled) setSettingsReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!settingsReady) return
    let cancelled = false
    setLoading(true)
    load(query)
      .catch((cause: unknown) => {
        if (!cancelled) setError(errorMessage(cause))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      requestId.current += 1
    }
  }, [load, query, settingsReady])

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true)
    setNotice(null)
    try {
      await action()
    } catch (cause: unknown) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }, [])

  const createNew = useCallback(() => {
    return run(async () => {
      const created = await getDesk().entries.create({})
      await load(queryRef.current, created.id)
      setSelectedId(created.id)
    })
  }, [load, run])

  const importLibrary = useCallback(() => {
    return run(async () => {
      const result = await getDesk().io.importLibrary()
      if (!result) return
      await reload()
      setEditorRevision((current) => current + 1)
      const skipped =
        result.skipped > 0 ? `, ${result.skipped} übersprungen` : ''
      setNotice(`Import: ${result.created} neu, ${result.updated} aktualisiert${skipped}`)
    })
  }, [reload, run])

  const exportLibrary = useCallback(() => {
    return run(async () => {
      const result = await getDesk().io.exportLibrary()
      if (!result) return
      setNotice('Bibliothek exportiert.')
    })
  }, [run])

  const updateEntry = useCallback(async (id: string, patch: UpdateEntryPatch): Promise<Entry> => {
    try {
      const saved = await getDesk().entries.update(id, patch)
      await load(queryRef.current)
      return saved
    } catch (cause: unknown) {
      setError(errorMessage(cause))
      throw cause
    }
  }, [load])

  const duplicateEntry = useCallback((id: string) => {
    return run(async () => {
      const created = await getDesk().entries.duplicate(id)
      await load(queryRef.current, created.id)
    })
  }, [load, run])

  const createVersion = useCallback((id: string) => {
    return run(async () => {
      const created = await getDesk().entries.createVersion(id)
      await load(queryRef.current, created.id)
    })
  }, [load, run])

  const deleteEntry = useCallback((id: string) => {
    return run(async () => {
      await getDesk().entries.delete(id)
      await load(queryRef.current)
    })
  }, [load, run])

  const syncEntry = useCallback((entry: Entry) => {
    setEntries((current) => current.map((item) => (item.id === entry.id ? entry : item)))
    setCatalog((current) => current.map((item) => (item.id === entry.id ? entry : item)))
  }, [])

  const selectedEntry =
    entries.find((entry) => entry.id === selectedId) ??
    catalog.find((entry) => entry.id === selectedId) ??
    null

  return {
    query,
    setSearch: (search: string) => {
      setNotice(null)
      setQuery((current) => ({ ...current, search }))
    },
    setFacet: (facet: LibraryFacet) => {
      setNotice(null)
      setQuery((current) => ({ ...current, facet }))
    },
    setSort: (sort: SortMode) => {
      sortTouched.current = true
      setQuery((current) => ({ ...current, sort }))
      void getDesk().settings.set('sortMode', sort).catch(() => undefined)
    },
    selectedId,
    selectedEntry,
    select: (id: string) => setSelectedId(id),
    entries,
    tags: collectTags(catalog),
    loading,
    busy,
    error,
    notice,
    editorRevision,
    reload,
    createNew,
    importLibrary,
    exportLibrary,
    updateEntry,
    duplicateEntry,
    createVersion,
    deleteEntry,
    syncEntry,
  }
}
