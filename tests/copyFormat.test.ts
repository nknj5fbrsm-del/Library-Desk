import { describe, it, expect } from 'vitest'
import {
  formatCopyStyle,
  formatCopyLyrics,
  formatCopyBoth,
  formatCopyGeneralAll,
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

  it('formatCopyGeneralAll skips empty sections', () => {
    expect(formatCopyGeneralAll('', '', 'Nur Prompt')).toBe('Prompt:\nNur Prompt')
    expect(formatCopyGeneralAll('Rolle', 'Hinweis', 'Text')).toBe(
      'Rolle/System:\nRolle\n\n---\n\nAnwendung:\nHinweis\n\n---\n\nPrompt:\nText',
    )
  })
})
