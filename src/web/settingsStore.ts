import { idbReq, idbTxDone, STORE_SETTINGS } from './idb'

interface SettingRow {
  key: string
  value: string
}

export async function getSetting(db: IDBDatabase, key: string): Promise<string | null> {
  const tx = db.transaction(STORE_SETTINGS, 'readonly')
  const row = await idbReq(
    tx.objectStore(STORE_SETTINGS).get(key) as IDBRequest<SettingRow | undefined>,
  )
  return row?.value ?? null
}

export async function setSetting(db: IDBDatabase, key: string, value: string): Promise<void> {
  const tx = db.transaction(STORE_SETTINGS, 'readwrite')
  const req = tx.objectStore(STORE_SETTINGS).put({ key, value } satisfies SettingRow)
  await Promise.all([idbReq(req), idbTxDone(tx)])
}
