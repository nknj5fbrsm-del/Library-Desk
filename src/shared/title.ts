export const EMPTY_TITLE = 'Ohne Titel'

export function normalizeTitle(title: string): string {
  const trimmed = title.trim()
  return trimmed.length === 0 ? EMPTY_TITLE : trimmed
}

/** True when the title is blank or the stored empty placeholder. */
export function isEmptyTitle(title: string): boolean {
  const trimmed = title.trim()
  return trimmed.length === 0 || trimmed === EMPTY_TITLE
}

/**
 * Editor input value: show a real empty field (with placeholder) instead of
 * the persisted "Ohne Titel" sentinel so typing a new title is not fighting
 * autosave that rewrites blanks back to the sentinel.
 */
export function titleForEditor(title: string): string {
  return isEmptyTitle(title) ? '' : title
}
