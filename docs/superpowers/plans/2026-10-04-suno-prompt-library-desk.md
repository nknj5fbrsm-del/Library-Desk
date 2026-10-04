# Library Desk MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eigenständige Electron-App „Library Desk“ zum lokalen Pflegen von Suno-Prompts (CRUD, Versionen, Tags, Suche, Copy, Export/Import, Mini-Audio-Player).

**Architecture:** Electron-Main besitzt SQLite (`better-sqlite3`) und Audio-Dateien unter `userData`; Preload exponiert eine typisierte `window.desk`-API; React-Renderer zeigt Split-UI (Liste | Detail) und spielt Audio über `HTMLAudioElement` ab.

**Tech Stack:** Electron, electron-vite, React 18, TypeScript, better-sqlite3, Vitest, electron-builder (später für Installer)

**Spec:** `docs/superpowers/specs/2026-10-04-suno-prompt-library-desk-design.md`

## Global Constraints

- Plattform: Electron-Desktop; kein Web-MVP
- Daten nur lokal; Teilen = Export/Import
- Start: leere Bibliothek ok; kein Mastermind-Import
- Persistenz: SQLite + Audio-Kopien unter `userData/audio/<entryId>/`
- Export: URLs mitnehmen; lokale Audio-Binaries **nicht** im JSON
- UI: Deutsch; Split Liste|Detail; ruhig, kein Dashboard
- Mastermind-Repo **nicht** anfassen
- Workspace = nur Ordner `suno-prompt-desk`
- Leerer Titel → speichern als `"Ohne Titel"`
- Timestamps DB: epoch ms; Export: ISO-8601
- Copy „Beides“: `stylePrompt` + `\n\n---\n\n` + `lyrics`
- Import: Upsert bei gleicher `id`
- Version-Badge nur wenn Gruppe ≥ 2 Einträge

---

## File Structure

```
suno-prompt-desk/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── vitest.config.ts
├── README.md
├── .vscode/tasks.json
├── .vscode/settings.json
├── .cursor/rules/dev-server-auto-start.mdc
├── src/
│   ├── main/
│   │   ├── index.ts              # BrowserWindow, lifecycle
│   │   ├── db.ts                 # open/migrate SQLite
│   │   ├── entriesRepo.ts        # CRUD, search, versions
│   │   ├── settingsRepo.ts       # key/value settings
│   │   ├── audioFs.ts            # copy/delete local audio
│   │   ├── importExport.ts       # .spd.json read/write + merge
│   │   └── ipc.ts                # register handlers
│   ├── preload/
│   │   └── index.ts              # contextBridge → window.desk
│   ├── shared/
│   │   ├── types.ts              # Entry, AudioRef, filters, IPC types
│   │   ├── copyFormat.ts         # clipboard string builders
│   │   ├── versionGroups.ts      # group entries for list UI
│   │   ├── exportFormat.ts       # parse/validate/serialize bundle
│   │   └── title.ts              # normalizeTitle
│   └── renderer/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── styles.css
│       ├── api.ts                # typed desk client
│       ├── components/
│       │   ├── Toolbar.tsx
│       │   ├── LibraryList.tsx
│       │   ├── EntryEditor.tsx
│       │   ├── MiniPlayer.tsx
│       │   └── ConfirmDialog.tsx
│       └── hooks/
│           ├── useLibrary.ts
│           └── useMiniPlayer.ts
└── tests/
    ├── title.test.ts
    ├── copyFormat.test.ts
    ├── versionGroups.test.ts
    ├── exportFormat.test.ts
    ├── entriesRepo.test.ts
    └── importExport.test.ts
```

---

### Task 1: Scaffold Electron + Vite + React + Vitest

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `vitest.config.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`, `src/renderer/styles.css`, `README.md`, `.vscode/tasks.json`, `.vscode/settings.json`, `.cursor/rules/dev-server-auto-start.mdc`, `.gitignore`
- Test: manuell App-Start

**Interfaces:**
- Consumes: nichts
- Produces: lauffähiges Electron-Fenster mit React „Library Desk“-Placeholder; Scripts `dev`, `build`, `test`

- [ ] **Step 1: Git init + .gitignore**

```bash
cd "/Users/nilspocklitz/Desktop/Cursor Projekte/suno-prompt-desk"
git init
```

`.gitignore`:

```
node_modules
dist
out
*.log
.DS_Store
coverage
```

- [ ] **Step 2: package.json anlegen**

```json
{
  "name": "suno-prompt-desk",
  "version": "0.1.0",
  "private": true,
  "description": "Library Desk — lokale Suno-Prompt-Bibliothek",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.7.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "electron": "^33.2.0",
    "electron-vite": "^2.3.0",
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 3: electron-vite + tsconfig + Minimal-Quellen**

`electron.vite.config.ts`:

```ts
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer'),
      },
    },
    plugins: [react()],
  },
})
```

`src/main/index.ts` — `BrowserWindow` mit `preload`, `contextIsolation: true`, `nodeIntegration: false`, Titel `Library Desk`, lädt Renderer.

`src/preload/index.ts` — vorerst `contextBridge.exposeInMainWorld('desk', { ping: () => 'pong' })`.

`src/renderer/App.tsx` — deutscher Placeholder: „Library Desk“.

- [ ] **Step 4: npm install + better-sqlite3 rebuild**

```bash
npm install
npx electron-rebuild -f -w better-sqlite3 || npx @electron/rebuild -f -w better-sqlite3
```

Falls `@electron/rebuild` fehlt: als devDependency hinzufügen und erneut ausführen.

- [ ] **Step 5: Dev starten und Fenster prüfen**

```bash
npm run dev
```

Expected: Electron-Fenster mit Text „Library Desk“, keine Console-Errors.

- [ ] **Step 6: VS Code Auto-Start + README**

`.vscode/tasks.json`: Background-Task `"npm run dev"` mit `"runOn": "folderOpen"`.  
`.vscode/settings.json`: `"task.allowAutomaticTasks": "on"`.  
`.cursor/rules/dev-server-auto-start.mdc`: Befehl `npm run dev`, Preview = Electron-Fenster.  
`README.md`: Start, Workspace-Hinweis, Spec/Plan-Links.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: scaffold Electron Vite React app for Library Desk

EOF
)"
```

---

### Task 2: Shared Types + reine Hilfsfunktionen (TDD)

**Files:**
- Create: `src/shared/types.ts`, `src/shared/title.ts`, `src/shared/copyFormat.ts`, `src/shared/versionGroups.ts`, `tests/title.test.ts`, `tests/copyFormat.test.ts`, `tests/versionGroups.test.ts`
- Modify: `vitest.config.ts` (alias `@shared`)

**Interfaces:**
- Consumes: Spec-Datenmodell
- Produces:
  - `normalizeTitle(title: string): string`
  - `formatCopyStyle(style: string): string`
  - `formatCopyLyrics(lyrics: string): string`
  - `formatCopyBoth(style: string, lyrics: string): string`
  - `groupEntriesForDisplay(entries: Entry[]): VersionGroup[]`
  - Types: `Entry`, `AudioRef`, `LibraryFacet`, `SortMode`, `VersionGroup`, `DeskExportBundle`

- [ ] **Step 1: Failing tests schreiben**

`tests/title.test.ts`:

```ts
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
```

`tests/copyFormat.test.ts`: Style / Lyrics / Beides mit Trenner `\n\n---\n\n`.

`tests/versionGroups.test.ts`:
- zwei Entries gleiche `groupId` → eine Gruppe, Badge-relevant (`versions.length >= 2`)
- Solo → eine Gruppe mit einem Entry
- Reihenfolge folgt Input-Reihenfolge der ersten Sichtungen

- [ ] **Step 2: Tests ausführen (FAIL)**

```bash
npm test
```

Expected: FAIL (Module fehlen).

- [ ] **Step 3: Types + Implementierung**

`src/shared/types.ts` (Kern):

```ts
export type AudioRef =
  | { kind: 'local'; relativePath: string; originalName: string }
  | { kind: 'url'; href: string; label?: string }

export interface Entry {
  id: string
  groupId: string
  version: number
  title: string
  stylePrompt: string
  lyrics: string
  notes: string
  tags: string[]
  isPower: boolean
  createdAt: number
  updatedAt: number
  audio: AudioRef | null
}

export type LibraryFacet = 'all' | 'power' | { tag: string }
export type SortMode = 'newest' | 'title' | 'updated'

export interface VersionGroup {
  key: string
  representative: Entry
  versions: Entry[] // ascending by version
}

export interface DeskExportBundle {
  format: 'suno-prompt-desk'
  formatVersion: 1
  exportedAt: string
  entries: unknown[]
}
```

`groupEntriesForDisplay`: wie Spec — `representative` = höchste `version`; Badge-Logik im UI anhand `versions.length >= 2`.

- [ ] **Step 4: Tests PASS**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared tests vitest.config.ts
git commit -m "$(cat <<'EOF'
feat: add shared types and pure library helpers

EOF
)"
```

---

### Task 3: SQLite DB + entriesRepo (TDD)

**Files:**
- Create: `src/main/db.ts`, `src/main/entriesRepo.ts`, `src/main/settingsRepo.ts`, `tests/entriesRepo.test.ts`
- Modify: nichts am Renderer

**Interfaces:**
- Consumes: `Entry`, `normalizeTitle`, `LibraryFacet`, `SortMode`
- Produces:
  - `openDatabase(dbPath: string): Database`
  - `migrate(db: Database): void`
  - `createEntry(db, input: CreateEntryInput): Entry`
  - `updateEntry(db, id, patch: UpdateEntryPatch): Entry`
  - `deleteEntry(db, id): void`
  - `getEntry(db, id): Entry | null`
  - `listEntries(db, query: ListQuery): Entry[]`
  - `duplicateEntry(db, id): Entry`
  - `createVersion(db, id): Entry`
  - `getSetting/setSetting(db, key, value)`

Schema:

```sql
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  style_prompt TEXT NOT NULL DEFAULT '',
  lyrics TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  is_power INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  audio_json TEXT
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX idx_entries_group ON entries(group_id);
CREATE INDEX idx_entries_updated ON entries(updated_at);
```

- [ ] **Step 1: Failing repo tests**

`tests/entriesRepo.test.ts` mit temp-dir DB:
1. create → get roundtrip (leerer Titel → `"Ohne Titel"`)
2. update ändert Felder + `updatedAt`
3. list filter `power`, tag, search substring in style
4. sort `title` / `newest` / `updated`
5. `createVersion` erhöht version, gleiche `groupId`, kopiert Inhalte
6. `duplicateEntry` neue `groupId`, `version === 1`
7. `deleteEntry` entfernt Zeile

- [ ] **Step 2: Run FAIL**

```bash
npm test -- tests/entriesRepo.test.ts
```

Expected: FAIL.

- [ ] **Step 3: db.ts + entriesRepo.ts + settingsRepo.ts implementieren**

`CreateEntryInput`: `{ title?, stylePrompt?, lyrics?, notes?, tags?, isPower?, audio? }` — generiert `id`, `groupId`, `version: 1`, timestamps.

`ListQuery`: `{ search: string; facet: LibraryFacet; sort: SortMode }`.

Tags als JSON-Array speichern; Audio als JSON oder `NULL`.

Search: `LOWER(title||' '||style_prompt||' '||lyrics||' '||notes||' '||tags_json) LIKE %q%` (einfach, ausreichend für MVP).

- [ ] **Step 4: Tests PASS**

```bash
npm test -- tests/entriesRepo.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/db.ts src/main/entriesRepo.ts src/main/settingsRepo.ts tests/entriesRepo.test.ts
git commit -m "$(cat <<'EOF'
feat: add SQLite schema and entries repository

EOF
)"
```

---

### Task 4: Export/Import-Format + Dateilogik (TDD)

**Files:**
- Create: `src/shared/exportFormat.ts`, `src/main/importExport.ts`, `tests/exportFormat.test.ts`, `tests/importExport.test.ts`

**Interfaces:**
- Consumes: `Entry`, `openDatabase`, repo
- Produces:
  - `entryToExportRow(entry: Entry): object`
  - `parseExportBundle(raw: unknown): DeskExportBundle & { entries: Entry[] }` (wirft bei ungültigem Format)
  - `buildExportBundle(entries: Entry[]): string` (JSON string)
  - `importBundle(db, bundle): { created: number; updated: number }`

Regeln:
- Export `audio.kind==='url'` vollständig
- Export `audio.kind==='local'` → `{ kind:'local', included:false, originalName }`
- Import local-meta → `audio: null` (keine abspielbare Datei; User hängt neu an). URL bleibt.
- Upsert by `id`

- [ ] **Step 1: Failing tests** für serialize/parse, local-audio stripping, upsert counts

- [ ] **Step 2: Run FAIL** → implementieren → PASS

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add suno-prompt-desk export/import format

EOF
)"
```

---

### Task 5: Audio-FS + IPC + Preload-API

**Files:**
- Create: `src/main/audioFs.ts`, `src/main/ipc.ts`
- Modify: `src/main/index.ts`, `src/preload/index.ts`
- Create: `src/shared/deskApi.ts` (API-Typen), `src/renderer/api.ts`

**Interfaces:**
- Consumes: repos, importExport, audioFs
- Produces: `window.desk` mit:

```ts
export interface DeskApi {
  entries: {
    list(query: ListQuery): Promise<Entry[]>
    get(id: string): Promise<Entry | null>
    create(input: CreateEntryInput): Promise<Entry>
    update(id: string, patch: UpdateEntryPatch): Promise<Entry>
    delete(id: string): Promise<void>
    duplicate(id: string): Promise<Entry>
    createVersion(id: string): Promise<Entry>
  }
  audio: {
    attachLocal(entryId: string): Promise<Entry> // dialog in main
    setUrl(entryId: string, href: string, label?: string): Promise<Entry>
    clear(entryId: string): Promise<Entry>
    resolveLocalUrl(entryId: string): Promise<string | null> // file:// or custom protocol
  }
  io: {
    exportLibrary(): Promise<{ filePath: string } | null>
    importLibrary(): Promise<{ created: number; updated: number } | null>
  }
  settings: {
    get(key: string): Promise<string | null>
    set(key: string, value: string): Promise<void>
  }
  shell: {
    openExternal(url: string): Promise<void>
  }
}
```

- [ ] **Step 1: `audioFs.ts`** — `copyLocalAudio(userData, entryId, sourcePath) => { relativePath, originalName }`; `deleteEntryAudio(userData, entryId)`; safe filename sanitize.

- [ ] **Step 2: `ipc.ts` registrieren** — DB-Pfad `join(app.getPath('userData'), 'library.db')`; Audio-Root `join(userData, 'audio')`.

- [ ] **Step 3: Custom protocol oder `file://`** — für lokale Wiedergabe: `pathToFileURL` zurückgeben (MVP ok bei `webSecurity` Default; falls blockiert: `desk://audio/...` protocol register). **Default-Versuch:** `pathToFileURL`. Wenn Play scheitert in Task 8: protocol nachziehen.

- [ ] **Step 4: Preload mapped channels 1:1** auf `window.desk`.

- [ ] **Step 5: Manuell im DevTools** `await window.desk.entries.create({ title: 'Test' })` und `list` prüfen.

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: wire IPC desk API for entries, audio, and IO

EOF
)"
```

---

### Task 6: Split-UI Shell + Library-Liste + Toolbar

**Files:**
- Create: `src/renderer/components/Toolbar.tsx`, `LibraryList.tsx`, `hooks/useLibrary.ts`
- Modify: `src/renderer/App.tsx`, `styles.css`

**Interfaces:**
- Consumes: `window.desk.entries.list`, `groupEntriesForDisplay`
- Produces: sichtbare leere Library + Neu-Button erzeugt Eintrag und Selektion

- [ ] **Step 1: `useLibrary`** — lädt Liste bei Mount / nach Mutationen; hält `query` (search/facet/sort), `selectedId`, `entries`, `reload()`.

- [ ] **Step 2: Toolbar** — Suche-Input, Facet-Select (Alle/Power), Tag-Filter (Dropdown aus vorhandenen Tags), Sort-Select, Buttons Neu / Import / Export.

- [ ] **Step 3: LibraryList** — gruppiert; Gruppenzeile Titel + Power-Markierung + Audio-Icon wenn `audio`; Chips `V1..Vn` nur wenn `versions.length >= 2`; Klick wählt Entry.

- [ ] **Step 4: Styles** — ruhige Desktop-UI (CSS-Variablen, kein purple-glow Dashboard); Split-Pane ~36% / 64%.

- [ ] **Step 5: Manuell** — App starten, Neu → Eintrag erscheint links.

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add split shell with library list and toolbar

EOF
)"
```

---

### Task 7: EntryEditor — Autosave, Duplizieren, Version, Löschen, Copy

**Files:**
- Create: `src/renderer/components/EntryEditor.tsx`, `ConfirmDialog.tsx`
- Modify: `App.tsx`, `useLibrary.ts`

**Interfaces:**
- Consumes: `desk.entries.*`, `copyFormat.*`, `navigator.clipboard`
- Produces: vollständiger Pflege-Flow ohne Audio

- [ ] **Step 1: EntryEditor Felder** — Titel, Power-Toggle, Tags (Comma/Chips-Input: Enter fügt Tag hinzu), Style-Textarea, Lyrics-Textarea, Notizen, Timestamps read-only.

- [ ] **Step 2: Autosave** — debounce 400ms auf `update`; Cmd/Ctrl+S flusht sofort.

- [ ] **Step 3: Aktionen** — Version anlegen, Duplizieren, Löschen (ConfirmDialog „Eintrag wirklich löschen?“), Copy Style / Lyrics / Beides (Toast oder kurz Status „Kopiert“).

- [ ] **Step 4: Shortcuts** global in `App`:
  - Cmd/Ctrl+N → create
  - Cmd/Ctrl+F → Fokus Suche
  - Cmd/Ctrl+Shift+C → copy both (wenn Entry ausgewählt)
  - Cmd/Ctrl+Backspace oder Delete → delete confirm (nur wenn Fokus nicht in Textarea) — **einfacher:** Menübutton reicht; Shortcut Delete nur mit Confirm wenn `document.activeElement` nicht input/textarea.

- [ ] **Step 5: Manuell verifizieren** — anlegen, versionieren, taggen, suchen, löschen, Clipboard.

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add entry editor with autosave, versions, and copy

EOF
)"
```

---

### Task 8: Mini-Player + Audio anhängen

**Files:**
- Create: `src/renderer/components/MiniPlayer.tsx`, `src/renderer/hooks/useMiniPlayer.ts`
- Modify: `EntryEditor.tsx`, `LibraryList.tsx`

**Interfaces:**
- Consumes: `desk.audio.*`, `desk.shell.openExternal`
- Produces: lokales + URL-Playback; ein aktiver Player

- [ ] **Step 1: `useMiniPlayer`** — hält globale Audio-Instanz (Module-Singleton), `play(src)`, `pause`, `seek`, `volume`; neuer `play` stoppt vorherigen.

- [ ] **Step 2: MiniPlayer UI** — Play/Pause, `<input type="range">` Progress, Dauer-Anzeige `mm:ss`, Volume-Slider; Fehlertext.

- [ ] **Step 3: EntryEditor Audio-Sektion** — „Lokale Datei…“ → `attachLocal`; „URL setzen“ Input+Button → `setUrl`; „Entfernen“ → `clear`; bei URL-Fehler Button „Im Browser öffnen“.

- [ ] **Step 4: Local src** — `resolveLocalUrl` → Player; fehlende Datei → „Audiodatei fehlt — bitte neu anhängen“.

- [ ] **Step 5: Manuell** — mp3 lokal + direkte Audio-URL; zweiter Play stoppt ersten; Listen-Icon sichtbar.

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add mini audio player and attach local/URL sources

EOF
)"
```

---

### Task 9: Export/Import UI + Settings-Persistenz für Sort/Volume

**Files:**
- Modify: `Toolbar.tsx`, `useLibrary.ts`, `useMiniPlayer.ts`, `App.tsx`

**Interfaces:**
- Consumes: `desk.io.*`, `desk.settings.*`
- Produces: Export/Import-Rundtrip; Sort/Volume merken

- [ ] **Step 1: Toolbar Export/Import** — ruft IPC; nach Import Summary-Alert/`status`: „Import: X neu, Y aktualisiert“; danach `reload()`.

- [ ] **Step 2: Settings** — keys `sortMode`, `volume`; laden beim Start, speichern bei Änderung.

- [ ] **Step 3: Manueller Rundtrip** — 2 Einträge (einer mit URL-Audio, einer mit local), Export `.spd.json`, DB leeren via Delete aller / frische userData oder Import auf zweite Kopie: URL bleibt, local audio null/ohne Datei, Metadaten ok.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add export/import UI and persist sort/volume settings

EOF
)"
```

---

### Task 10: Polish, README-Verifikation, MVP-Abnahme

**Files:**
- Modify: `README.md`, `src/renderer/styles.css`, Spec-Statuszeile optional
- Test: manuelle Abnahme-Checkliste

**Interfaces:**
- Consumes: gesamtes MVP
- Produces: dokumentierter Start + erfüllte Erfolgskriterien

- [ ] **Step 1: README final**

Enthalten muss:
- Workspace nur `suno-prompt-desk`
- `npm install` / ggf. rebuild
- `npm run dev`
- `npm test`
- Kurz Export-Format-Hinweis → Spec Abschnitt 8

- [ ] **Step 2: Abnahme-Checkliste manuell**

- [ ] App startet leer
- [ ] Anlegen / Duplizieren / Version / Umbenennen / Löschen+Confirm
- [ ] Tags + Power + Suche + Filter + Sort
- [ ] Copy Style / Lyrics / Beides
- [ ] Audio lokal + URL + ein Play gleichzeitig + Fehlerhinweise
- [ ] Export/Import Rundtrip
- [ ] UI DE, Split, ruhig

- [ ] **Step 3: `npm test` grün + Commit**

```bash
npm test
git add -A
git commit -m "$(cat <<'EOF'
docs: finalize README and MVP verification notes

EOF
)"
```

---

## Self-Review (Plan vs Spec)

| Spec-Anforderung | Task |
|---|---|
| Electron + React Desktop | 1 |
| SQLite + audio copies | 3, 5, 8 |
| Split-UI | 6–7 |
| Entry-Felder + Power + Timestamps | 3, 7 |
| Versionen | 3 (`createVersion`), 6–7 |
| Suche/Filter/Sort | 3, 6 |
| CRUD + Confirm delete | 3, 7 |
| Copy Style/Lyrics/Beides | 2, 7 |
| Export/Import Format | 4, 9 |
| DE-UI + Shortcuts | 6–7, 10 |
| Audio local/URL + Mini-Player + list icon + single play | 5, 8 |
| Settings sort/volume | 3, 9 |
| Dev-docs / auto-start | 1, 10 |
| Kein Mastermind-Import / Cloud / Pipeline | bewusst keine Tasks |

Keine offenen TBD/TODO in Tasks. Typnamen konsistent: `Entry`, `AudioRef`, `ListQuery`, `DeskApi`.
