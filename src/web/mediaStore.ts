import { mimeFromFilename } from '../shared/mime'
import { idbReq, idbTxDone, STORE_MEDIA } from './idb'

export interface MediaRow {
  id: string
  blob: Blob
  mimeType: string
  originalName: string
}

export function audioMediaId(entryId: string): string {
  return `audio:${entryId}`
}

export function coverMediaId(entryId: string): string {
  return `cover:${entryId}`
}

export function attachmentMediaId(entryId: string, attachmentId: string): string {
  return `attachment:${entryId}:${attachmentId}`
}

export async function putMedia(
  db: IDBDatabase,
  id: string,
  blob: Blob,
  originalName: string,
): Promise<void> {
  const mimeType = blob.type || mimeFromFilename(originalName)
  const typed =
    blob.type === mimeType ? blob : new Blob([await blob.arrayBuffer()], { type: mimeType })
  const row: MediaRow = {
    id,
    blob: typed,
    mimeType,
    originalName,
  }
  const tx = db.transaction(STORE_MEDIA, 'readwrite')
  const req = tx.objectStore(STORE_MEDIA).put(row)
  await Promise.all([idbReq(req), idbTxDone(tx)])
}

export async function getMedia(db: IDBDatabase, id: string): Promise<MediaRow | null> {
  const tx = db.transaction(STORE_MEDIA, 'readonly')
  const row = await idbReq(tx.objectStore(STORE_MEDIA).get(id) as IDBRequest<MediaRow | undefined>)
  return row ?? null
}

export async function deleteMedia(db: IDBDatabase, id: string): Promise<void> {
  const tx = db.transaction(STORE_MEDIA, 'readwrite')
  const req = tx.objectStore(STORE_MEDIA).delete(id)
  await Promise.all([idbReq(req), idbTxDone(tx)])
}

export async function deleteEntryMedia(
  db: IDBDatabase,
  entryId: string,
  attachmentIds: string[] = [],
): Promise<void> {
  await deleteMedia(db, audioMediaId(entryId))
  await deleteMedia(db, coverMediaId(entryId))
  for (const attachmentId of attachmentIds) {
    await deleteMedia(db, attachmentMediaId(entryId, attachmentId))
  }
}

export async function resolveObjectUrl(db: IDBDatabase, id: string): Promise<string | null> {
  const row = await getMedia(db, id)
  if (!row) return null
  return URL.createObjectURL(row.blob)
}
