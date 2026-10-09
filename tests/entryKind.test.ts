import { describe, expect, it } from 'vitest'
import { normalizeEntryKind, withEntryKindDefaults } from '../src/shared/entryKind'

describe('entryKind', () => {
  it('defaults unknown values to suno', () => {
    expect(normalizeEntryKind(undefined)).toBe('suno')
    expect(normalizeEntryKind('nope')).toBe('suno')
    expect(normalizeEntryKind('general')).toBe('general')
  })

  it('fills missing general fields on legacy rows', () => {
    const hydrated = withEntryKindDefaults({ id: '1' })
    expect(hydrated.kind).toBe('suno')
    expect(hydrated.promptBody).toBe('')
    expect(hydrated.systemRole).toBe('')
    expect(hydrated.usageGuide).toBe('')
  })
})
