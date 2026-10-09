# Library Desk — Agent-Handoff (Mac + Web parallel)

**Stand:** 2026-10-09  
**Produktname:** Library Desk  
**Ordner:** `~/Desktop/Cursor Projekte/Library Desk`  
**GitHub:** https://github.com/nknj5fbrsm-del/Library-Desk.git · Branch `main`  
**npm-Name (unverändert):** `suno-prompt-desk` → Electron-`userData` = `~/Library/Application Support/suno-prompt-desk`  
**Export-Format-ID:** `format: "suno-prompt-desk"` (nicht umbenennen)

## Was das Projekt ist

Eine Codebase, **zwei Targets**:

| Target | Zweck | Dev | Build / Deploy |
|--------|--------|-----|----------------|
| **Mac (Electron)** | Desktop-Bibliothek | `npm run dev` | `npm run dist:mac` → `release/*.dmg` |
| **Web / Smart** | Browser + Mobile | `npm run dev:web` → http://localhost:5174/index.web.html | `npm run build:web` → `dist-web/` · Vercel (`vercel.json`) |

Stack: Electron + electron-vite + React/TS + better-sqlite3 · Web: Vite + IndexedDB + JSZip.

## Parallel arbeiten (Struktur)

```
src/shared/*     ← zuerst ändern (Types, Export, Filter, Kind)
src/renderer/*   ← UI (gilt Mac + Web)
src/main/*       ← nur Mac (SQLite, FS, IPC, Menü)
src/preload/*    ← nur Mac
src/web/*        ← nur Web (DeskApi IndexedDB, Zip, Bootstrap)
```

**Regel:** Shared/UI zuerst; danach Target-Adapter (Main vs Web) anpassen. Immer `npm test` (Electron-Vitest). Web-Build: `npm run build:web`. Mac-Installer: `npm run dist:mac`.

## Kernfunktionen (fertig)

- Einträge: Suno **und** Allgemein (`kind`), Titel, Style/Lyrics bzw. Rolle/Anwendung/Prompt, Notizen, Tags, Sterne, Versionen
- Cover + Audio (lokal/URL), Publish-Links, Filter inkl. Art
- SPD-**Zip** Export/Import inkl. Medien (Bibliothek sichern + Eintrag-Export); JSON weiter importierbar
- Mobile Master-Detail; Cover-Glow; Split-Breite; Tag-Undo/Redo
- Leerer Titel bleibt editierbar; DB-Migration `kind`/Prompt-Felder (Index erst nach ALTER)

## Wichtige Pfade

- UI: `src/renderer/components/EntryEditor.tsx`, `LibraryList.tsx`, `Toolbar.tsx`, `App.tsx`, `NewKindDialog.tsx`, `styles.css`
- Mac-Daten: `src/main/db.ts`, `entriesRepo.ts`, `spdBundle.ts`, `ipc.ts`
- Web-Daten: `src/web/deskApi.ts`, `entriesStore.ts`, `spdBundle.ts`
- Shared: `src/shared/types.ts`, `entryKind.ts`, `exportFormat.ts`, `listQuery.ts`
- Specs: `docs/superpowers/specs/`

## Arbeitsregeln

- Compact German an Nutzer
- Commits nur auf explizite Bitte
- Vor Änderungen: `git status` / `npm test`
- Workspace = Ordner **Library Desk** (nicht Elternordner „Cursor Projekte“)
- Nicht nutzen: leerer Ordner „Suno Prompt Library“ o.ä. Chat-Reste

## Hinweise

- better-sqlite3 bei Electron-Problemen: `npx @electron/rebuild -f -w better-sqlite3`
- Gatekeeper: DMG unsigniert → Rechtsklick → Öffnen
- npm-`name` nicht leichtfertig ändern (sonst neuer leerer userData-Pfad)
- Vercel deployt von GitHub `main`; Web und Mac teilen denselben Commit-Stand
