import { describe, expect, it } from 'vitest'
import { MOBILE_MEDIA_QUERY } from '../src/renderer/hooks/useMobileLayout'

describe('mobile layout', () => {
  it('uses the shared breakpoint query for CSS parity', () => {
    expect(MOBILE_MEDIA_QUERY).toBe('(max-width: 767.98px)')
  })
})
