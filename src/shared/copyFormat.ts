const BOTH_SEPARATOR = '\n\n---\n\n'

export function formatCopyStyle(style: string): string {
  return style
}

export function formatCopyLyrics(lyrics: string): string {
  return lyrics
}

export function formatCopyBoth(style: string, lyrics: string): string {
  return `${style}${BOTH_SEPARATOR}${lyrics}`
}
