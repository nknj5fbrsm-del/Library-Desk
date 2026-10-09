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

export function formatCopyPromptBody(body: string): string {
  return body
}

export function formatCopySystemRole(role: string): string {
  return role
}

export function formatCopyUsageGuide(guide: string): string {
  return guide
}

/** Rolle + Anweisung + Prompt, mit Abschnitten nur wenn befüllt. */
export function formatCopyGeneralAll(
  systemRole: string,
  usageGuide: string,
  promptBody: string,
): string {
  const parts: string[] = []
  const role = systemRole.trim()
  const guide = usageGuide.trim()
  const body = promptBody.trim()
  if (role.length > 0) parts.push(`Rolle/System:\n${role}`)
  if (guide.length > 0) parts.push(`Anwendung:\n${guide}`)
  if (body.length > 0) parts.push(`Prompt:\n${body}`)
  return parts.join(BOTH_SEPARATOR)
}
