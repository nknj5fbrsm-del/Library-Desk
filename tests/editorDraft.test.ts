import { describe, expect, it } from 'vitest'
import { applyExternalEntry, type EditorDraftFields } from '../src/shared/editorDraft'

const current: EditorDraftFields = {
  title: 'Alt',
  stylePrompt: 'warm',
  lyrics: 'alte zeile',
  notes: '',
  tags: ['nacht'],
  rating: 0,
}

const imported: EditorDraftFields = {
  ...current,
  lyrics: 'importierte zeile',
  tags: ['tag'],
}

describe('applyExternalEntry', () => {
  it('adopts the library row when the editor is clean', () => {
    expect(applyExternalEntry(current, imported, false)).toEqual(imported)
  })

  it('keeps the in-progress draft when the editor is dirty', () => {
    expect(applyExternalEntry(current, imported, true)).toBe(current)
  })

  it('keeps the same draft object when the row matches', () => {
    const incoming = { ...current, tags: [...current.tags] }
    expect(applyExternalEntry(current, incoming, false)).toBe(current)
  })
})
