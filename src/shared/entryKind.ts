import type { AttachmentRef, Entry, EntryKind } from './types'
import { normalizeAttachments } from './types'

export function normalizeEntryKind(value: unknown): EntryKind {
  return value === 'general' ? 'general' : 'suno'
}

/** Fill kind/general fields for legacy rows (SQLite migrate / IndexedDB / import). */
export function withEntryKindDefaults<T extends Partial<Entry> & Pick<Entry, 'id'>>(
  entry: T,
): T & Pick<Entry, 'kind' | 'promptBody' | 'systemRole' | 'usageGuide' | 'attachments'> {
  const kind = normalizeEntryKind(entry.kind)
  const attachments: AttachmentRef[] =
    kind === 'general' ? normalizeAttachments(entry.attachments) : []
  return {
    ...entry,
    kind,
    promptBody: typeof entry.promptBody === 'string' ? entry.promptBody : '',
    systemRole: typeof entry.systemRole === 'string' ? entry.systemRole : '',
    usageGuide: typeof entry.usageGuide === 'string' ? entry.usageGuide : '',
    attachments,
  }
}

export function kindLabel(kind: EntryKind): string {
  return kind === 'general' ? 'Allgemein' : 'Suno'
}
