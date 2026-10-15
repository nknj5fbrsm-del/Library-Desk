import { normalizeTitle } from './title'
import type { PublishLink, StarRating } from './types'
import { normalizePublishLinks } from './types'

export interface EditorDraftFields {
  title: string
  stylePrompt: string
  lyrics: string
  promptBody: string
  systemRole: string
  usageGuide: string
  notes: string
  tags: readonly string[]
  rating: StarRating
  published: boolean
  publishLinks: readonly PublishLink[]
}

function samePublishLinks(a: readonly PublishLink[], b: readonly PublishLink[]): boolean {
  const left = normalizePublishLinks([...a])
  const right = normalizePublishLinks([...b])
  return (
    left.length === right.length &&
    left.every(
      (link, index) =>
        link.id === right[index]?.id &&
        link.label === right[index]?.label &&
        link.href === right[index]?.href,
    )
  )
}

export function sameEditorDraft(a: EditorDraftFields, b: EditorDraftFields): boolean {
  return (
    a.title === b.title &&
    a.stylePrompt === b.stylePrompt &&
    a.lyrics === b.lyrics &&
    a.promptBody === b.promptBody &&
    a.systemRole === b.systemRole &&
    a.usageGuide === b.usageGuide &&
    a.notes === b.notes &&
    a.rating === b.rating &&
    a.published === b.published &&
    a.tags.length === b.tags.length &&
    a.tags.every((tag, index) => tag === b.tags[index]) &&
    samePublishLinks(a.publishLinks, b.publishLinks)
  )
}

/**
 * Keep the typed title when the library row only differs by trim/sentinel
 * (`normalizeTitle`). Otherwise autosave reload would eat the space between words.
 */
export function preferLiveTitle(draftTitle: string, incomingTitle: string): string {
  if (draftTitle === incomingTitle) return draftTitle
  if (normalizeTitle(draftTitle) === normalizeTitle(incomingTitle)) return draftTitle
  return incomingTitle
}

/** Keep unsaved edits. Otherwise adopt the library row after import or reload. */
export function applyExternalEntry<T extends EditorDraftFields>(
  current: T,
  incoming: T,
  dirty: boolean,
): T {
  if (dirty) return current
  const merged = {
    ...incoming,
    title: preferLiveTitle(current.title, incoming.title),
  } as T
  if (sameEditorDraft(current, merged)) return current
  return merged
}
