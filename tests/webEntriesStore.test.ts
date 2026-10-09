import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { deskDbName, openDeskDb } from '../src/web/idb'
import * as store from '../src/web/entriesStore'
import * as settings from '../src/web/settingsStore'

function deleteDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(deskDbName())
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}

let db: IDBDatabase

beforeEach(async () => {
  try {
    db?.close()
  } catch {
    /* ignore */
  }
  await deleteDb()
  db = await openDeskDb()
})

describe('web entriesStore', () => {
  it('starts empty and creates an entry', async () => {
    expect(await store.listEntries(db, { search: '', facet: 'all', kind: 'all', sort: 'title' })).toEqual([])
    const created = await store.createEntry(db, { title: 'Hello' })
    expect(created.title).toBe('Hello')
    expect(created.version).toBe(1)
    const listed = await store.listEntries(db, { search: '', facet: 'all', kind: 'all', sort: 'title' })
    expect(listed).toHaveLength(1)
  })

  it('updates, duplicates, versions, and deletes', async () => {
    const created = await store.createEntry(db, { title: 'Song', stylePrompt: 'folk' })
    const updated = await store.updateEntry(db, created.id, { lyrics: 'la' })
    expect(updated.lyrics).toBe('la')

    const dup = await store.duplicateEntry(db, created.id)
    expect(dup.id).not.toBe(created.id)
    expect(dup.groupId).not.toBe(created.groupId)
    expect(dup.version).toBe(1)

    const v2 = await store.createVersion(db, created.id)
    expect(v2.groupId).toBe(created.groupId)
    expect(v2.version).toBe(2)

    await store.deleteEntry(db, dup.id)
    const listed = await store.listEntries(db, { search: '', facet: 'all', kind: 'all', sort: 'title' })
    expect(listed.map((e) => e.id).sort()).toEqual([created.id, v2.id].sort())
  })

  it('persists settings', async () => {
    expect(await settings.getSetting(db, 'splitListWidth')).toBeNull()
    await settings.setSetting(db, 'splitListWidth', '320')
    expect(await settings.getSetting(db, 'splitListWidth')).toBe('320')
  })
})
