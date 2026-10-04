import type { Entry, VersionGroup } from './types'

export function groupEntriesForDisplay(entries: Entry[]): VersionGroup[] {
  const order: string[] = []
  const byGroup = new Map<string, Entry[]>()

  for (const entry of entries) {
    if (!byGroup.has(entry.groupId)) {
      order.push(entry.groupId)
      byGroup.set(entry.groupId, [])
    }
    byGroup.get(entry.groupId)!.push(entry)
  }

  return order.map((groupId) => {
    const versions = [...byGroup.get(groupId)!].sort(
      (a, b) => a.version - b.version,
    )
    const representative = versions.reduce((best, current) =>
      current.version > best.version ? current : best,
    )
    return {
      key: groupId,
      representative,
      versions,
    }
  })
}
