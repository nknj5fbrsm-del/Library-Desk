# Library Desk — Agent-Handoff (Mac + Web parallel)

**Stand:** 2026-10-10  
**Produktname:** Library Desk  
**Workspace-Ordner:** `~/Desktop/Cursor Projekte/Library Desk` (umbenannt von `suno-prompt-desk`)  
**GitHub:** https://github.com/nknj5fbrsm-del/Library-Desk.git · Branch `main` (sync mit origin)  
**npm-`name` (unverändert):** `suno-prompt-desk` → Electron-`userData` = `~/Library/Application Support/suno-prompt-desk`  
**productName:** `Library Desk` (Menü, DMG, Fenster)  
**Export-Format-ID:** `format: "suno-prompt-desk"` — **nicht umbenennen**  
**Version:** 0.1.0

## Sofort starten

1. Workspace **nur** als Ordner `Library Desk` öffnen (nicht Elternordner „Cursor Projekte“).
2. Dev: `npm run dev` → Electron-Fenster (Auto-Start via `.vscode/tasks.json`).
3. Web: `npm run dev:web` → http://localhost:5174/index.web.html
4. Vor Code-Änderungen: `git status` · nach Shared/DB: `npm test`
5. **Release / Neubau (Pflicht alle Targets):** `npm run release:all` → Tests + Web (`dist-web/`) + Mac-DMG (`release/*.dmg`). Nie nur DMG oder nur Web.

## Was das Projekt ist

Eine Codebase, **zwei Targets**:

| Target | Zweck | Dev | Build / Deploy |
|--------|--------|-----|----------------|
| **Mac (Electron)** | Desktop-Bibliothek | `npm run dev` | `npm run dist:mac` → `release/Library Desk-0.1.0-arm64.dmg` |
| **Web / Smart** | Browser + Mobile | `npm run dev:web` | `npm run build:web` → `dist-web/` · Vercel (`vercel.json`) |

Stack: Electron + electron-vite + React/TS + better-sqlite3 · Web: Vite + IndexedDB + JSZip.  
API-Grenze: `DeskApi` (Main/IPC vs Web/IndexedDB).

## Parallel arbeiten (Struktur)

```
src/shared/*     ← zuerst ändern (Types, Export, Filter, Kind)
src/renderer/*   ← UI (gilt Mac + Web)
src/main/*       ← nur Mac (SQLite, FS, IPC, Menü)
src/preload/*    ← nur Mac
src/web/*        ← nur Web (DeskApi IndexedDB, Zip, Bootstrap)
```

**Regel:** Shared/UI zuerst; danach Target-Adapter (Main vs Web). Immer `npm test`. Bei auslieferbarem Stand: `npm run release:all` (Web + Desktop/DMG).

## Kernfunktionen (fertig)

- Einträge: Suno **und** Allgemein (`kind`), Titel, Style/Lyrics bzw. Rolle/Anwendung/Prompt, Notizen, Tags, Sterne, Versionen
- Cover + Audio (lokal/URL), Publish-Links, Filter inkl. Art
- SPD-**Zip** (`.spd.zip`) Export/Import inkl. Medien — Toolbar „Bibliothek sichern“ + Eintrag-Export; reines JSON weiter importierbar
- **Auto-Backup (nur Mac/Electron):** Toolbar „Auto-Backup“ — täglich stilles `.spd.zip` in wählbaren Ordner (Default `~/Documents/Library Desk Backups`, 03:00, 14 behalten, Catch-up beim Start). Beim **App-Beenden** (Cmd+Q) immer Nachfrage: Mit Backup / Ohne / Abbrechen. Web: nur manueller Export.
- Mobile Master-Detail; Cover-Glow; Split-Breite; Tag-Undo/Redo
- Leerer Titel bleibt editierbar (kein Zwang „Ohne Titel“)
- DB-Migration `kind` + Prompt-Felder: **ALTER zuerst, Index danach** (`src/main/db.ts`)

## Zuletzt erledigt (diese Session)

- Cloud-PRs auf Mac gezogen: general `kind`, mobile toolbar, empty title
- Zip-Export mit Medien (Shared + Main + Web)
- Toolbar-Backup-Button Layout (nicht mehr gequetscht)
- **Bugfix packaged App:** Fenster startete nicht — `SqliteError: no such column: kind` weil `CREATE INDEX` vor `ALTER TABLE`; Fix in `3ade652`, Test `tests/dbMigrate.test.ts`
- Docs/Rules auf Ordnername **Library Desk**; globaler Dev-Server-Rule-Eintrag
- Ordner-Rename auf Disk + Agent-Root umgestellt

## Wichtige Pfade

| Bereich | Dateien |
|---------|---------|
| UI | `src/renderer/components/EntryEditor.tsx`, `LibraryList.tsx`, `Toolbar.tsx`, `App.tsx`, `NewKindDialog.tsx`, `styles.css` |
| Mac-Daten | `src/main/db.ts`, `entriesRepo.ts`, `spdBundle.ts`, `autoBackupService.ts`, `ipc.ts`, `index.ts` |
| Auto-Backup | `src/shared/autoBackup.ts`, `src/renderer/components/AutoBackupDialog.tsx` |
| Web-Daten | `src/web/deskApi.ts`, `entriesStore.ts`, `spdBundle.ts` |
| Shared | `src/shared/types.ts`, `entryKind.ts`, `exportFormat.ts`, `listQuery.ts`, `spdZip.ts` |
| Specs | `docs/superpowers/specs/` (Zip, Web, Kind, Mobile, Icon, …) |
| Packaging | `package.json` (`build`), `build/icon.*`, `release/` |

## Arbeitsregeln (Nutzer)

- Antworten: **compact German** (Ergebnis + Nächster Schritt)
- **Commits nur auf explizite Bitte** — nicht von allein pushen
- Workspace = `Library Desk`; alte Pfade `suno-prompt-desk` nur noch historisch/npm
- Nicht nutzen: leerer Ordner „Suno Prompt Library“ o.ä. Chat-Reste
- **Neubau/Release:** immer Web + Desktop + DMG (`npm run release:all` / Rule `release-all-targets`)

## Bekannte Fallstricke

- **npm-`name` nicht ändern** → sonst neuer leerer `userData`-Pfad, alte Bibliothek „weg“
- **Export-Format-ID** `suno-prompt-desk` beibehalten (Kompatibilität Zip/JSON)
- better-sqlite3 nach Electron-Update: `npx @electron/rebuild -f -w better-sqlite3`
- Gatekeeper: DMG unsigniert → Rechtsklick → Öffnen
- **Win-Cross-Build** von Mac bricht (Mach-O `better-sqlite3`) — Windows nur CI/nativ
- Alte DMGs nach Feature-Merges neu bauen — sonst fehlen Features (z. B. Anhänge): `npm run release:all`
- Vercel: `main` → `dist-web`; Install mit `--ignore-scripts`

## Aktueller Git-Stand

- `main` = `origin/main` inkl. Anhänge (PR #4–#6); Release-Skript: `npm run release:all`
- Lokale DMG/`dist-web` unter `release/` bzw. `dist-web/` (nicht committen)

## Offene / sinnvolle nächste Themen (nicht committed als Todo)

- Optional: Windows-Build nur über CI dokumentieren/einrichten
- Auto-Backup: `launchd` wenn App komplett zu ist (bewusst nicht MVP)
- Weitere Features nur nach Nutzerauftrag
