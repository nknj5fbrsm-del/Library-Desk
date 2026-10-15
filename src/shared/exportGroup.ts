import type { Entry } from './types'

/**
 * Expand seed entry ids to every version in their groups (deduped, stable order).
 * Used by single-entry and bulk SPD zip export.
 */
export function collectEntriesForExport(catalog: readonly Entry[], seedIds: readonly string[]): Entry[] {
  const byId = new Map(catalog.map((entry) => [entry.id, entry]))
  const groupIds = new Set<string>()
  for (const id of seedIds) {
    const entry = byId.get(id)
    if (entry) groupIds.add(entry.groupId)
  }
  if (groupIds.size === 0) return []

  const seen = new Set<string>()
  const result: Entry[] = []
  for (const entry of catalog) {
    if (!groupIds.has(entry.groupId) || seen.has(entry.id)) continue
    seen.add(entry.id)
    result.push(entry)
  }
  return result
}
