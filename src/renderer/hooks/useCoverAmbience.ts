import { useEffect, useState } from 'react'
import { getDesk } from '@renderer/api'
import { extractCoverAmbience } from '@renderer/coverColor'
import type { Entry } from '@shared/types'

const CLEAR = 'transparent'

export function useCoverAmbience(entry: Entry | null): string {
  const [ambience, setAmbience] = useState(CLEAR)

  useEffect(() => {
    if (!entry?.cover) {
      setAmbience(CLEAR)
      return
    }

    let cancelled = false
    const entryId = entry.id
    void getDesk()
      .cover.resolveUrl(entryId)
      .then(async (url) => {
        if (cancelled || !url) {
          if (!cancelled) setAmbience(CLEAR)
          return
        }
        try {
          const color = await extractCoverAmbience(url)
          if (!cancelled) setAmbience(color ?? CLEAR)
        } catch {
          if (!cancelled) setAmbience(CLEAR)
        }
      })
      .catch(() => {
        if (!cancelled) setAmbience(CLEAR)
      })

    return () => {
      cancelled = true
    }
  }, [entry?.id, entry?.cover?.relativePath])

  return ambience
}
