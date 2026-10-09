import { describe, expect, it } from 'vitest'
import { applyExternalEntry, sameEditorDraft, type EditorDraftFields } from '../src/shared/editorDraft'
import { normalizePublishLinks } from '../src/shared/types'

const current: EditorDraftFields = {
  title: 'Alt',
  stylePrompt: 'warm',
  lyrics: 'alte zeile',
  promptBody: '',
  systemRole: '',
  usageGuide: '',
  notes: '',
  tags: ['nacht'],
  rating: 0,
  published: false,
  publishLinks: [],
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

describe('sameEditorDraft publish fields', () => {
  const base = current

  it('differs when published flag changes', () => {
    expect(
      sameEditorDraft(
        { ...base, published: false, publishLinks: [] },
        { ...base, published: true, publishLinks: [] },
      ),
    ).toBe(false)
  })

  it('differs when publish link href changes', () => {
    expect(
      sameEditorDraft(
        {
          ...base,
          published: true,
          publishLinks: [{ id: 'a', label: 'YT', href: 'https://youtu.be/x' }],
        },
        {
          ...base,
          published: true,
          publishLinks: [{ id: 'a', label: 'YT', href: 'https://youtu.be/y' }],
        },
      ),
    ).toBe(false)
  })

  it('ignores empty-href draft rows when comparing publish links', () => {
    expect(
      sameEditorDraft(
        {
          ...base,
          published: true,
          publishLinks: [{ id: 'draft', label: '', href: '' }],
        },
        {
          ...base,
          published: true,
          publishLinks: [],
        },
      ),
    ).toBe(true)
  })
})

describe('normalizePublishLinks', () => {
  it('trims fields and drops empty href rows', () => {
    expect(
      normalizePublishLinks([
        { id: '1', label: ' YT ', href: ' https://youtu.be/x ' },
        { id: '2', label: 'x', href: '  ' },
        { id: '3', label: '', href: 'https://open.spotify.com/track/1' },
      ]),
    ).toEqual([
      { id: '1', label: 'YT', href: 'https://youtu.be/x' },
      { id: '3', label: '', href: 'https://open.spotify.com/track/1' },
    ])
  })
})
