import type { PublishLink, StarRating } from './types'

export interface EditorDraftFields {
  title: string
  stylePrompt: string
  lyrics: string
  notes: string
  tags: readonly string[]
  rating: StarRating
  published: boolean
  publishLinks: readonly PublishLink[]
}

export function sameEditorDraft(a: EditorDraftFields, b: EditorDraftFields): boolean {
  return (
    a.title === b.title &&
    a.stylePrompt === b.stylePrompt &&
    a.lyrics === b.lyrics &&
    a.notes === b.notes &&
    a.rating === b.rating &&
    a.published === b.published &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index]) &&
    a.publishLinks.length === b.publishLinks.length &&
    a.publishLinks.every(
      (link, index) =>
        link.id === b.publishLinks[index]?.id &&
        link.label === b.publishLinks[index]?.label &&
        link.href === b.publishLinks[index]?.href,
    )
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
