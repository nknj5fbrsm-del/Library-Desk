export interface EditorDraftFields {
  title: string
  stylePrompt: string
  lyrics: string
  notes: string
  tags: readonly string[]
  isPower: boolean
}

export function sameEditorDraft(a: EditorDraftFields, b: EditorDraftFields): boolean {
  return (
    a.title === b.title &&
    a.stylePrompt === b.stylePrompt &&
    a.lyrics === b.lyrics &&
    a.notes === b.notes &&
    a.isPower === b.isPower &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index])
  )
}

/** Keep unsaved edits. Otherwise adopt the library row after import or reload. */
export function applyExternalEntry<T extends EditorDraftFields>(
  current: T,
  incoming: T,
  dirty: boolean,
): T {
  if (dirty || sameEditorDraft(current, incoming)) return current
  return incoming
}
