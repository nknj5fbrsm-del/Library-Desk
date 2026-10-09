import { describe, expect, it } from 'vitest'
import { canOpenInBrowser, mimeFromFilename } from '../src/shared/mime'

describe('mime', () => {
  it('maps common attachment extensions', () => {
    expect(mimeFromFilename('Brief.pdf')).toBe('application/pdf')
    expect(mimeFromFilename('notes.TXT')).toBe('text/plain')
    expect(mimeFromFilename('readme.md')).toBe('text/markdown')
    expect(mimeFromFilename('unknown.bin')).toBe('application/octet-stream')
  })

  it('detects browser-viewable types', () => {
    expect(canOpenInBrowser('application/pdf')).toBe(true)
    expect(canOpenInBrowser('text/plain')).toBe(true)
    expect(canOpenInBrowser('image/png')).toBe(true)
    expect(canOpenInBrowser('application/msword')).toBe(false)
  })
})
