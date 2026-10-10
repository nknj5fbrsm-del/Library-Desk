# Library Desk

Lokale Suno-Prompt-Bibliothek als Electron-App.

## Workspace

Diesen Ordner (`Library Desk`) als eigenen Workspace öffnen — nicht den Elternordner „Cursor Projekte“. Beim Öffnen startet `npm run dev` über die VS-Code-Aufgabe. Es öffnet sich ein Electron-Fenster (kein Browser-URL).

Technisch: npm-Paketname bleibt `suno-prompt-desk` (Electron-`userData` / SQLite-Pfad). GitHub: `Library-Desk`. Export-Format-ID bleibt `suno-prompt-desk`.

## Start

```bash
npm install
npx electron-rebuild -f -w better-sqlite3
npm run dev
```

`better-sqlite3` muss zur Electron-ABI passen. Nach einem Wechsel von Electron oder Node den Rebuild wiederholen.

Weitere Skripte: `npm run build`, `npm run preview`.

## Web

Browser-Version derselben UI (IndexedDB, ohne Login):

- Dev: `npm run dev:web` → http://localhost:5174/index.web.html
- Build: `npm run build:web` → `dist-web/` (static host / Vercel / Netlify)
- Bibliothek liegt in IndexedDB dieses Browsers — kein Sync mit der Desktop-App; Austausch über Export/Import.

### Vercel

1. Repo auf GitHub: `https://github.com/nknj5fbrsm-del/Library-Desk.git`
2. [Vercel](https://vercel.com) → **Add New… → Project** → GitHub-Repo **Library-Desk** importieren
3. Einstellungen kommen aus `vercel.json` (Build: `npm run build:web`, Output: `dist-web`)
4. Deploy — fertige URL teilen; jeder Nutzer hat seine eigene Bibliothek im Browser

## Build / Installer

- **Alles (Web + Mac-DMG + Tests):** `npm run release:all` → `dist-web/` + `release/*.dmg` — nach Features immer dieses Kommando, nicht nur DMG.
- **Mac allein:** `npm run dist:mac` → `release/*.dmg`
- **Web allein:** `npm run build:web` → `dist-web/`
- **Windows:** Auf einer **Windows-Maschine oder in CI** bauen: `npm run dist:win` → `release/*.exe` (NSIS, Zielarchitektur **x64**). `better-sqlite3` ist nativ — ein von macOS erzeugter Windows-Installer ist **nicht lauffähig** und wird nicht als Deliverable unterstützt.

## Tests

```bash
npm test
```

Vitest läuft unter Electron (`ELECTRON_RUN_AS_NODE=1`), damit `better-sqlite3` dieselbe ABI wie die App nutzt. Watch-Modus: `npm run test:watch`.

## Export / Import

**Bibliothek sichern** / Eintrag-**Export** schreiben eine `.spd.zip` (eine Datei, inkl. lokaler Audio- und Cover-Dateien). Import akzeptiert `.spd.zip` sowie weiterhin `.spd.json` / Mastermind-JSON. URL-Audio bleibt in der JSON-Metadaten-Datei im Zip.

**Auto-Backup (nur Desktop):** Toolbar → **Auto-Backup**. Täglich stilles Voll-Backup als `.spd.zip` (Default 03:00, Ordner `~/Documents/Library Desk Backups`, 14 Dateien behalten). App muss laufen; verpasste Slots werden beim Start nachgeholt. Web: nur manueller Export.

Import akzeptiert:
- Desk-Bundle (`format: "suno-prompt-desk"`)
- **Suno-Mastermind**-JSON (Array von Bibliothekseinträgen, z. B. Export aus der Mastermind-Bibliothek)

Nicht mappbare Mastermind-Felder (Pipeline, Mashup, Rating …) werden verworfen. Einträge ohne Style und ohne Lyrics werden übersprungen. Cover-Data-URLs werden nach `userData/covers/` kopiert und in Liste/Detail angezeigt.

## Spec und Plan

- Spec: `docs/superpowers/specs/2026-10-04-suno-prompt-library-desk-design.md`
- Plan: `docs/superpowers/plans/2026-10-04-suno-prompt-library-desk.md`
