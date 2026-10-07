import { useEffect, useState } from 'react'

/** Matches CSS `@media (max-width: 767.98px)`. */
export const MOBILE_MEDIA_QUERY = '(max-width: 767.98px)'

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MEDIA_QUERY).matches : false,
  )

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY)
    const onChange = (): void => setIsMobile(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
