import { describe, it, expect } from 'vitest'
import { normalizeTitle } from '../src/shared/title'

describe('normalizeTitle', () => {
  it('trims and keeps non-empty', () => {
    expect(normalizeTitle('  Hello  ')).toBe('Hello')
  })
  it('maps empty to Ohne Titel', () => {
    expect(normalizeTitle('   ')).toBe('Ohne Titel')
  })
})
