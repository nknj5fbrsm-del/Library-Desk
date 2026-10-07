import { describe, it, expect } from 'vitest'
import { isEmptyTitle, normalizeTitle, titleForEditor } from '../src/shared/title'

describe('normalizeTitle', () => {
  it('trims and keeps non-empty', () => {
    expect(normalizeTitle('  Hello  ')).toBe('Hello')
  })
  it('maps empty to Ohne Titel', () => {
    expect(normalizeTitle('   ')).toBe('Ohne Titel')
  })
})

describe('titleForEditor', () => {
  it('maps the empty sentinel and blanks to an empty input', () => {
    expect(titleForEditor('Ohne Titel')).toBe('')
    expect(titleForEditor('  Ohne Titel  ')).toBe('')
    expect(titleForEditor('')).toBe('')
    expect(titleForEditor('   ')).toBe('')
  })

  it('keeps real titles', () => {
    expect(titleForEditor('Nachtzug')).toBe('Nachtzug')
  })
})

describe('isEmptyTitle', () => {
  it('detects blanks and the sentinel', () => {
    expect(isEmptyTitle('')).toBe(true)
    expect(isEmptyTitle('  ')).toBe(true)
    expect(isEmptyTitle('Ohne Titel')).toBe(true)
    expect(isEmptyTitle('Song')).toBe(false)
  })
})
