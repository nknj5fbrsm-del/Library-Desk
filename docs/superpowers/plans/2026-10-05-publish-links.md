# Publish Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einträge als veröffentlicht markieren, mehrere Publish-Links speichern, Link-UI nur bei aktiver Checkbox zeigen, Listenfilter „Veröffentlicht“.

**Architecture:** `published: boolean` und `publishLinks: PublishLink[]` am `Entry`; SQLite-Spalten + JSON; Facet `'published'`; Editor-Checkbox blendet Linkliste ein/aus ohne Links zu löschen; Autosave/Undo wie Tags.

**Tech Stack:** Electron + React/TS, better-sqlite3, Vitest (`npm test` / `ELECTRON_RUN_AS_NODE=1`).

## Global Constraints

- Deutsch in der UI („Veröffentlicht“, „+ Link“, „Öffnen“, Filter „Veröffentlicht“).
- Beim Abhaken von „Veröffentlicht“ Links behalten (nur UI ausblenden).
- Keine Plattform-Enums; Label frei.
- Leere `href` (nach Trim) nicht persistieren.
- Bestehende Patterns: `ALTER TABLE`-Migration in `db.ts`, Repo in `entriesRepo.ts`, Export in `exportFormat.ts`.

## File Map

| File | Role |
|---|---|
| `src/shared/types.ts` | `PublishLink`, Entry-Felder, `LibraryFacet`, `normalizePublishLinks` |
| `src/shared/deskApi.ts` | `CreateEntryInput` Felder |
| `src/shared/editorDraft.ts` | Draft-Vergleich um Publish-Felder |
| `src/shared/exportFormat.ts` | Export/Import Serialize |
| `src/main/db.ts` | Migration Spalten |
| `src/main/entriesRepo.ts` | CRUD + Facet-Filter |
| `src/renderer/components/Toolbar.tsx` | Filter-Option |
| `src/renderer/components/EntryEditor.tsx` | Checkbox + Linkliste |
| `src/renderer/styles.css` | Minimale Styles |
| `tests/entriesRepo.test.ts` | Persistenz + Filter |
| `tests/exportFormat.test.ts` | Roundtrip |
| `tests/editorDraft.test.ts` | Draft-Gleichheit |

---

### Task 1: Shared Types + Draft-Equality

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/deskApi.ts`
- Modify: `src/shared/editorDraft.ts`
- Modify: `tests/editorDraft.test.ts`

**Interfaces:**
- Produces: `PublishLink`, `normalizePublishLinks`, `Entry.published`, `Entry.publishLinks`, `LibraryFacet` includes `'published'`

- [ ] **Step 1: Write failing draft test**

In `tests/editorDraft.test.ts` assert that drafts differ when `published` or `publishLinks` differ (extend existing helper fixtures with the new fields once types exist — first add expectations that will fail until `sameEditorDraft` is updated).

```ts
expect(
  sameEditorDraft(
    { ...base, published: false, publishLinks: [] },
    { ...base, published: true, publishLinks: [] },
  ),
).toBe(false)

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
```

Also add a unit test for `normalizePublishLinks` in the same file or a tiny new describe in `tests/editorDraft.test.ts`:

```ts
import { normalizePublishLinks } from '../src/shared/types'

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
```

- [ ] **Step 2: Run tests — expect fail**

Run: `npm test -- tests/editorDraft.test.ts`
Expected: FAIL (missing types / equality)

- [ ] **Step 3: Implement types**

In `src/shared/types.ts` add:

```ts
export interface PublishLink {
  id: string
  label: string
  href: string
}

export interface Entry {
  // ...existing fields...
  published: boolean
  publishLinks: PublishLink[]
}

export type LibraryFacet = 'all' | 'rated' | 'published' | { tag: string }

export function normalizePublishLinks(links: PublishLink[] | undefined): PublishLink[] {
  if (!links) return []
  const out: PublishLink[] = []
  for (const link of links) {
    if (!link || typeof link.id !== 'string' || link.id.length === 0) continue
    const href = typeof link.href === 'string' ? link.href.trim() : ''
    if (!href) continue
    const label = typeof link.label === 'string' ? link.label.trim() : ''
    out.push({ id: link.id, label, href })
  }
  return out
}
```

In `src/shared/deskApi.ts` extend `CreateEntryInput`:

```ts
published?: boolean
publishLinks?: PublishLink[]
```

(import `PublishLink` from `./types`)

In `src/shared/editorDraft.ts` extend `EditorDraftFields` and `sameEditorDraft`:

```ts
published: boolean
publishLinks: readonly PublishLink[]

// in sameEditorDraft:
a.published === b.published &&
a.publishLinks.length === b.publishLinks.length &&
a.publishLinks.every(
  (link, i) =>
    link.id === b.publishLinks[i]?.id &&
    link.label === b.publishLinks[i]?.label &&
    link.href === b.publishLinks[i]?.href,
)
```

Update any test fixtures that construct full `Entry` / draft objects to include `published: false` and `publishLinks: []`.

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- tests/editorDraft.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/shared/deskApi.ts src/shared/editorDraft.ts tests/editorDraft.test.ts
git commit -m "$(cat <<'EOF'
feat: add published flag and publishLinks types

EOF
)"
```

---

### Task 2: DB Migration + Repository

**Files:**
- Modify: `src/main/db.ts`
- Modify: `src/main/entriesRepo.ts`
- Modify: `tests/entriesRepo.test.ts`
- Modify: any other tests constructing `Entry` that break compile

**Interfaces:**
- Consumes: `normalizePublishLinks`, `Entry.published`, `Entry.publishLinks`
- Produces: persisted columns; `listEntries` facet `'published'` → `published = 1`

- [ ] **Step 1: Write failing repo tests**

Append to `tests/entriesRepo.test.ts`:

```ts
it('persists published flag and publish links; filter published', () => {
  const db = openDatabase(':memory:')
  const live = createEntry(db, {
    title: 'Live',
    published: true,
    publishLinks: [
      { id: 'l1', label: 'YouTube', href: 'https://youtu.be/abc' },
      { id: 'l2', label: 'x', href: '  ' },
    ],
  })
  const draft = createEntry(db, { title: 'Draft' })
  expect(live.published).toBe(true)
  expect(live.publishLinks).toEqual([
    { id: 'l1', label: 'YouTube', href: 'https://youtu.be/abc' },
  ])
  expect(draft.published).toBe(false)
  expect(draft.publishLinks).toEqual([])

  const updated = updateEntry(db, live.id, { published: false })
  expect(updated.published).toBe(false)
  expect(updated.publishLinks).toEqual(live.publishLinks)

  const base = { search: '', facet: 'all' as const, sort: 'newest' as const }
  expect(listEntries(db, { ...base, facet: 'published' }).map((e) => e.id)).toEqual([])
  updateEntry(db, live.id, { published: true })
  expect(listEntries(db, { ...base, facet: 'published' }).map((e) => e.id)).toEqual([
    live.id,
  ])
})

it('copies published state on duplicate and version', () => {
  const db = openDatabase(':memory:')
  const original = createEntry(db, {
    title: 'Pub',
    published: true,
    publishLinks: [{ id: 'p1', label: 'SC', href: 'https://soundcloud.com/x' }],
  })
  const copy = duplicateEntry(db, original.id)
  expect(copy.published).toBe(true)
  expect(copy.publishLinks).toEqual(original.publishLinks)
  const version = createVersion(db, original.id)
  expect(version.published).toBe(true)
  expect(version.publishLinks).toEqual(original.publishLinks)
})
```

Update existing `entry` fixtures / expectations only if TypeScript breaks (defaults from createEntry).

- [ ] **Step 2: Run test — expect fail**

Run: `npm test -- tests/entriesRepo.test.ts`
Expected: FAIL (columns / fields missing)

- [ ] **Step 3: Migrate DB**

In `src/main/db.ts` add to `SCHEMA` CREATE TABLE (for new DBs):

```
published INTEGER NOT NULL DEFAULT 0,
publish_links_json TEXT NOT NULL DEFAULT '[]'
```

And in `migrate` after rating migration:

```ts
if (!columns.includes('published')) {
  db.exec('ALTER TABLE entries ADD COLUMN published INTEGER NOT NULL DEFAULT 0')
}
if (!columns.includes('publish_links_json')) {
  db.exec(`ALTER TABLE entries ADD COLUMN publish_links_json TEXT NOT NULL DEFAULT '[]'`)
}
```

- [ ] **Step 4: Wire entriesRepo**

- Extend `EntryRow` with `published: number | null` and `publish_links_json: string | null`.
- In `rowToEntry`:

```ts
published: row.published === 1,
publishLinks: normalizePublishLinks(
  row.publish_links_json ? (JSON.parse(row.publish_links_json) as PublishLink[]) : [],
),
```

- Thread `published` / `publishLinks` through `insertGenerated`, `upsertFullEntry`, `createEntry`, `updateEntry`, `copiedContent`.
- Serialize with `JSON.stringify(normalizePublishLinks(...))` and `published ? 1 : 0`.
- In `listEntries`, after rated branch:

```ts
} else if (query.facet === 'published') {
  where.push('published = 1')
}
```

- [ ] **Step 5: Run tests — expect pass**

Run: `npm test -- tests/entriesRepo.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/db.ts src/main/entriesRepo.ts tests/entriesRepo.test.ts
git commit -m "$(cat <<'EOF'
feat: persist published flag and publish links

EOF
)"
```

---

### Task 3: Export / Import

**Files:**
- Modify: `src/shared/exportFormat.ts`
- Modify: `tests/exportFormat.test.ts`

**Interfaces:**
- Consumes: `PublishLink`, `normalizePublishLinks`
- Produces: export rows include `published` + `publishLinks`; parse defaults missing → `false` / `[]`

- [ ] **Step 1: Write failing export tests**

Update `entry()` fixture in `tests/exportFormat.test.ts` with `published: false, publishLinks: []`.

Add:

```ts
it('roundtrips published links and defaults missing fields', () => {
  const source = entry({
    published: true,
    publishLinks: [{ id: 'yt', label: 'YouTube', href: 'https://youtu.be/1' }],
  })
  const parsed = parseExportBundle(JSON.parse(buildExportBundle([source])))
  expect(parsed.entries[0]?.published).toBe(true)
  expect(parsed.entries[0]?.publishLinks).toEqual(source.publishLinks)

  const legacy = entryToExportRow(entry())
  const { published: _p, publishLinks: _l, ...without } = legacy as ExportEntryRow & Record<string, unknown>
  // Build a raw object without published fields:
  const raw = JSON.parse(buildExportBundle([entry()])) as {
    entries: Array<Record<string, unknown>>
  }
  delete raw.entries[0].published
  delete raw.entries[0].publishLinks
  const legacyParsed = parseExportBundle(raw)
  expect(legacyParsed.entries[0]?.published).toBe(false)
  expect(legacyParsed.entries[0]?.publishLinks).toEqual([])
})
```

(Simplify if the destructuring is awkward — goal: missing keys → defaults.)

Update the first `toEqual` snapshot expectations to include `published: false, publishLinks: []`.

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- tests/exportFormat.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement exportFormat**

- Add fields to `ExportEntryRow`.
- `entryToExportRow`: `published: entry.published`, `publishLinks: normalizePublishLinks(entry.publishLinks)`.
- `parseEntry`:

```ts
published: raw.published === undefined ? false : requireBoolean(raw.published, 'published'),
publishLinks: raw.publishLinks === undefined ? [] : parsePublishLinks(raw.publishLinks),
```

```ts
function parsePublishLinks(value: unknown): PublishLink[] {
  if (!Array.isArray(value)) invalid('publishLinks')
  const links: PublishLink[] = []
  for (const item of value) {
    if (!isRecord(item)) invalid('publishLinks')
    const id = requireNonEmpty(item.id, 'publishLinks.id')
    const href = requireText(item.href, 'publishLinks.href')
    const label = item.label === undefined ? '' : requireText(item.label, 'publishLinks.label')
    links.push({ id, label, href })
  }
  return normalizePublishLinks(links)
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- tests/exportFormat.test.ts`
Expected: PASS

Also run full suite: `npm test` — fix any remaining `Entry` fixture compile errors in other tests (`mastermindImport`, etc.) by adding defaults.

- [ ] **Step 5: Commit**

```bash
git add src/shared/exportFormat.ts tests/exportFormat.test.ts tests/
git commit -m "$(cat <<'EOF'
feat: export and import published links

EOF
)"
```

---

### Task 4: Toolbar Filter

**Files:**
- Modify: `src/renderer/components/Toolbar.tsx`
- Modify: `src/renderer/App.tsx` only if `filtered` logic needs `'published'` (today `facet !== 'all'` already covers it — verify, no change if OK)

**Interfaces:**
- Consumes: `LibraryFacet` `'published'`
- Produces: UI option that calls `onFacet('published')`

- [ ] **Step 1: Update Toolbar facet select**

```tsx
const facetValue =
  facet === 'rated' ? 'rated' : facet === 'published' ? 'published' : 'all'

<select
  aria-label="Filter"
  value={facetValue}
  onChange={(event) => {
    const value = event.target.value
    if (value === 'rated') onFacet('rated')
    else if (value === 'published') onFacet('published')
    else onFacet('all')
  }}
>
  <option value="all">Alle</option>
  <option value="rated">Mit Sternen</option>
  <option value="published">Veröffentlicht</option>
</select>
```

- [ ] **Step 2: Manual smoke (dev)**

Run: `npm run dev` — Filter-Dropdown zeigt „Veröffentlicht“ (noch 0 Treffer bis Editor Task).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Toolbar.tsx
git commit -m "$(cat <<'EOF'
feat: add published library filter

EOF
)"
```

---

### Task 5: EntryEditor UI

**Files:**
- Modify: `src/renderer/components/EntryEditor.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Consumes: `Entry.published`, `Entry.publishLinks`, `getDesk().shell.openExternal`
- Produces: Checkbox + conditional link list; autosave via existing `patchDraft` / `applyDraft` with history

- [ ] **Step 1: Extend Draft**

```ts
interface Draft {
  // existing...
  published: boolean
  publishLinks: PublishLink[]
}

function toDraft(entry: Entry): Draft {
  return {
    // existing...
    published: entry.published,
    publishLinks: entry.publishLinks.map((link) => ({ ...link })),
  }
}
```

Update `cloneDraft` to deep-copy `publishLinks`.

In `writeIfDirty` patch include:

```ts
published: sent.published,
publishLinks: normalizePublishLinks(sent.publishLinks),
```

- [ ] **Step 2: Add UI below rating / meta**

Place after `StarRatingInput` or after Tags — preferred: after Tags field as own block:

```tsx
<label className="field field-inline">
  <input
    type="checkbox"
    checked={draft.published}
    onChange={(event) => patchDraft({ published: event.target.checked }, true)}
  />
  <span className="field-label">Veröffentlicht</span>
</label>

{draft.published ? (
  <div className="publish-links" aria-label="Publish-Links">
    {draft.publishLinks.map((link) => (
      <div key={link.id} className="publish-link-row">
        <input
          aria-label="Link-Label"
          placeholder="YouTube, Spotify…"
          value={link.label}
          onChange={(event) => {
            const label = event.target.value
            patchDraft(
              {
                publishLinks: draftRef.current.publishLinks.map((item) =>
                  item.id === link.id ? { ...item, label } : item,
                ),
              },
              true,
            )
          }}
        />
        <input
          aria-label="Link-URL"
          placeholder="https://"
          value={link.href}
          onChange={(event) => {
            const href = event.target.value
            patchDraft(
              {
                publishLinks: draftRef.current.publishLinks.map((item) =>
                  item.id === link.id ? { ...item, href } : item,
                ),
              },
              true,
            )
          }}
        />
        <button
          type="button"
          className="btn"
          disabled={!link.href.trim()}
          onClick={() => void getDesk().shell.openExternal(link.href.trim())}
        >
          Öffnen
        </button>
        <button
          type="button"
          className="btn"
          aria-label="Link entfernen"
          onClick={() =>
            patchDraft(
              {
                publishLinks: draftRef.current.publishLinks.filter(
                  (item) => item.id !== link.id,
                ),
              },
              true,
            )
          }
        >
          ×
        </button>
      </div>
    ))}
    <button
      type="button"
      className="btn"
      onClick={() =>
        patchDraft(
          {
            publishLinks: [
              ...draftRef.current.publishLinks,
              { id: crypto.randomUUID(), label: '', href: '' },
            ],
          },
          true,
        )
      }
    >
      + Link
    </button>
  </div>
) : null}
```

Note: empty `href` rows may exist in draft for editing; `normalizePublishLinks` strips them on save. That is intentional so „+ Link“ works.

- [ ] **Step 3: Styles**

In `src/renderer/styles.css` add compact row layout:

```css
.field-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.publish-links {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.publish-link-row {
  display: grid;
  grid-template-columns: minmax(6rem, 1fr) minmax(10rem, 2fr) auto auto;
  gap: 0.35rem;
  align-items: center;
}
```

- [ ] **Step 4: Manual verify**

1. Eintrag öffnen → Checkbox an → „+ Link“ → Label/URL → Autosave.
2. Checkbox aus → Liste weg; an → Links wieder da.
3. Filter „Veröffentlicht“ zeigt nur markierte.
4. Cmd+Z nach Link-Löschen stellt wieder her (Draft-Undo).

- [ ] **Step 5: Full test suite**

Run: `npm test`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/EntryEditor.tsx src/renderer/styles.css
git commit -m "$(cat <<'EOF'
feat: publish checkbox and multi-link editor

EOF
)"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| `published` + `publishLinks[]` | 1, 2 |
| Keep links when unchecked | 5 (UI hide only) |
| DB migration | 2 |
| Export/Import defaults | 3 |
| Editor checkbox + list + open | 5 |
| Filter „Veröffentlicht“ | 2 (query) + 4 (UI) |
| Undo/Autosave | 5 (`patchDraft(..., true)`) |

## Placeholder / Consistency Scan

- Names consistent: `published`, `publishLinks`, `PublishLink`, facet `'published'`.
- No TBDs.
