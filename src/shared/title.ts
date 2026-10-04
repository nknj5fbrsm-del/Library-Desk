const EMPTY_TITLE = 'Ohne Titel'

export function normalizeTitle(title: string): string {
  const trimmed = title.trim()
  return trimmed.length === 0 ? EMPTY_TITLE : trimmed
}
