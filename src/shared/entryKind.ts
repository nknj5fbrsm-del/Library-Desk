import type { Entry, EntryKind } from './types'

export function normalizeEntryKind(value: unknown): EntryKind {
  return value === 'general' ? 'general' : 'suno'
}

/** Fill kind/general fields for legacy rows (SQLite migrate / IndexedDB / import). */
export function withEntryKindDefaults<T extends Partial<Entry> & Pick<Entry, 'id'>>(
  entry: T,
): T & Pick<Entry, 'kind' | 'promptBody' | 'systemRole' | 'usageGuide'> {
  return {
    ...entry,
    kind: normalizeEntryKind(entry.kind),
    promptBody: typeof entry.promptBody === 'string' ? entry.promptBody : '',
    systemRole: typeof entry.systemRole === 'string' ? entry.systemRole : '',
    usageGuide: typeof entry.usageGuide === 'string' ? entry.usageGuide : '',
  }
}

export function kindLabel(kind: EntryKind): string {
  return kind === 'general' ? 'Allgemein' : 'Suno'
}
