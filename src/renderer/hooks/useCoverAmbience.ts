import { useEffect, useState } from 'react'
import { getDesk } from '@renderer/api'
import { extractCoverAmbience } from '@renderer/coverColor'
import type { Entry } from '@shared/types'

export const COVER_AMBIENCE_CLEAR = 'transparent'

export function useCoverAmbience(entry: Entry | null): string {
  const [ambience, setAmbience] = useState(COVER_AMBIENCE_CLEAR)

  useEffect(() => {
    if (!entry?.cover) {
      setAmbience(COVER_AMBIENCE_CLEAR)
      return
    }

    let cancelled = false
    const entryId = entry.id
    void getDesk()
      .cover.resolveUrl(entryId)
      .then(async (url) => {
        if (cancelled || !url) {
          if (!cancelled) setAmbience(COVER_AMBIENCE_CLEAR)
          return
        }
        try {
          const color = await extractCoverAmbience(url)
          if (!cancelled) setAmbience(color ?? COVER_AMBIENCE_CLEAR)
        } catch {
          if (!cancelled) setAmbience(COVER_AMBIENCE_CLEAR)
        }
      })
      .catch(() => {
        if (!cancelled) setAmbience(COVER_AMBIENCE_CLEAR)
      })

    return () => {
      cancelled = true
    }
  }, [entry?.id, entry?.cover?.relativePath])

  return ambience
}

/** Two-layer opacity crossfade so cover glow blends softly between entries. */
export function useCoverAmbienceLayers(entry: Entry | null): {
  front: string
  back: string
  frontActive: boolean
} {
  const target = useCoverAmbience(entry)
  const [front, setFront] = useState(COVER_AMBIENCE_CLEAR)
  const [back, setBack] = useState(COVER_AMBIENCE_CLEAR)
  const [frontActive, setFrontActive] = useState(true)

  useEffect(() => {
    const active = frontActive ? front : back
    if (target === active) return
    if (frontActive) {
      setBack(target)
      setFrontActive(false)
    } else {
      setFront(target)
      setFrontActive(true)
    }
  }, [target, front, back, frontActive])

  return { front, back, frontActive }
}
