import { useEffect, useState } from 'react'
import { getDesk } from '@renderer/api'
import type { Entry } from '@shared/types'

interface CoverThumbProps {
  entry: Entry
  size?: 'list' | 'detail'
}

export function CoverThumb({ entry, size = 'list' }: CoverThumbProps): JSX.Element | null {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!entry.cover) {
      setSrc(null)
      return
    }
    let cancelled = false
    void getDesk()
      .cover.resolveUrl(entry.id)
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc(null)
      })
    return () => {
      cancelled = true
    }
  }, [entry.id, entry.cover?.relativePath])

  if (!src) return null

  return (
    <img
      className={size === 'detail' ? 'cover-thumb cover-thumb-detail' : 'cover-thumb'}
      src={src}
      alt=""
      draggable={false}
    />
  )
}
