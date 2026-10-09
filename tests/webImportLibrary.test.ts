import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { buildExportBundle } from '../src/shared/exportFormat'
import { deskDbName, openDeskDb } from '../src/web/idb'
import * as store from '../src/web/entriesStore'
import { importLibraryJson } from '../src/web/importLibrary'

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(deskDbName())
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}

beforeEach(async () => {
  await deleteDb()
})

describe('web importLibraryJson', () => {
  it('imports a desk export bundle', async () => {
    const db = await openDeskDb()
    const created = await store.createEntry(db, { title: 'Export Me', stylePrompt: 'jazz' })
    const json = buildExportBundle([created])
    const raw = JSON.parse(json) as unknown
    db.close()

    await deleteDb()
    const db2 = await openDeskDb()
    const result = await importLibraryJson(db2, raw)
    expect(result.created).toBe(1)
    const listed = await store.listEntries(db2, { search: '', facet: 'all', kind: 'all', sort: 'title' })
    expect(listed).toHaveLength(1)
    expect(listed[0]?.title).toBe('Export Me')
    db2.close()
  })
})
