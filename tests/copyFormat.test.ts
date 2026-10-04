import { describe, it, expect } from 'vitest'
import {
  formatCopyStyle,
  formatCopyLyrics,
  formatCopyBoth,
} from '../src/shared/copyFormat'

describe('copy format helpers', () => {
  it('formatCopyStyle returns style as-is', () => {
    expect(formatCopyStyle('dark synthwave')).toBe('dark synthwave')
  })

  it('formatCopyLyrics returns lyrics as-is', () => {
    expect(formatCopyLyrics('[Verse]\nLine')).toBe('[Verse]\nLine')
  })

  it('formatCopyBoth joins with separator', () => {
    const style = 'upbeat pop'
    const lyrics = 'Hello world'
    expect(formatCopyBoth(style, lyrics)).toBe(
      `${style}\n\n---\n\n${lyrics}`,
    )
  })
})
