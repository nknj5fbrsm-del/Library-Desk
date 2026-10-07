# Library Desk — Web-Version Design

**Datum:** 2026-10-07  
**Status:** Freigegeben / umgesetzt  
**Produktname:** Library Desk (Web)  
**Repo:** `suno-prompt-desk`

## 1. Ziel

Parallele **Browser-Version** derselben Bibliothek-UI, die per URL geteilt werden kann. Jeder Nutzer hat eine **eigene** Bibliothek im eigenen Browser — **ohne Login**, ohne Cloud-Sync im v1.

Desktop (Electron) bleibt die Haupt-App; Web ist ein zweites Target im gleichen Repo.

## 2. Entscheidungen

| Thema | Entscheidung |
|---|---|
| Ansatz | IndexedDB-Adapter hinter bestehendem `DeskApi` |
| Auth | Keine |
| Sync Desktop ↔ Web | Nur Export/Import (`.spd.json` / Mastermind-JSON) |
| Speicherung | IndexedDB (Einträge + Settings); Cover/lokales Audio als Blobs |
| Hosting | Statisches Vite-Build → Vercel / Netlify / GitHub Pages (HTTPS) |
| Scope | Ein Repo, Scripts `dev:web` / `build:web` |

## 3. Architektur

```
React UI (renderer)
        │
        ▼
   getDesk() → window.desk : DeskApi
        │
   ┌────┴────┐
   │ Electron│  preload → IPC → SQLite + Dateisystem
   │ Web     │  webDeskApi → IndexedDB + Blob-Store
   └─────────┘
```

- Bestehende UI (`App`, `EntryEditor`, Hooks) bleibt; nur die DeskApi-Implementierung wechselt.
- Electron-Preload unverändert.
- Web-Bootstrap setzt `window.desk` vor dem React-Mount.

## 4. Feature-Parität

| Bereich | Web v1 |
|---|---|
| Einträge, Versionen, Tags, Sterne, Style/Lyrics/Notizen, Filter | ja |
| Cover (Datei, Anzeige, Glow) | ja (Blob) |
| Audio URL + Mini-Player | ja |
| Lokales Audio | ja (File-Picker → Blob) |
| Export/Import Desk + Mastermind | ja (Download / `<input type="file">`) |
| Publish-Links / Veröffentlicht | ja |
| Undo/Redo | ja (Browser-Tastatur; kein natives Menü) |
| Split-Breite | ja (Settings in IndexedDB/localStorage) |
| Leerer Start | ja (kein Seed) |

### Nicht in Web v1

- Accounts, Multi-Device-Sync, gemeinsamer Speicher mit der Mac-App
- Native Systemdialoge / App-Menü / Dock-Icon / Installer
- Server-seitige Persistenz

## 5. DeskApi-Web: Verhalten

- `entries.*` — CRUD/Versionen/Duplikat analog `entriesRepo`, Persistenz IndexedDB.
- `audio.attachLocal` / `cover.attachLocal` — Browser File-Picker; Speicherung als Blob; Resolve via `URL.createObjectURL` (oder gespeicherte Object-URLs / Blob-IDs).
- `audio.setUrl` / `clear` — wie Desktop.
- `io.exportLibrary` — JSON-Download; `io.importLibrary` — File-Open + bestehende Import-Logik (shared).
- `shell.openExternal` — `window.open(url, '_blank', 'noopener')`.
- `edit.onUndo` / `onRedo` — optional Keydown-Listener Cmd/Ctrl+Z / Shift+Z (oder UI-Buttons nur wenn nötig).

Shared-Module (`exportFormat`, `mastermindImport`, Types, Copy-Format) wiederverwenden; Main-only (`better-sqlite3`, `fs`) nicht im Web-Bundle.

## 6. UX-Hinweise

- Kurzer Persistenz-Hinweis: Daten bleiben in diesem Browser; Export empfohlen.
- Quota: bei IndexedDB-Voll → verständliche Fehlermeldung.
- CORS: URL-Audio wie Desktop (Hinweis + „Im Browser öffnen“ bei Fehlern).

## 7. Build & Deploy

| Script | Zweck |
|---|---|
| `npm run dev:web` | Vite Dev-Server (Browser) |
| `npm run build:web` | Statisches Output z. B. `dist-web/` |

- Output gitignored.
- Deploy: beliebiger Static Host; URL zum Teilen.
- Electron-Scripts (`dev`, `dist:*`) unverändert.

## 8. Tests

- Unit-Tests für IndexedDB-Adapter (Vitest; Fake-IndexedDB oder in-memory Absraction).
- Bestehende Shared-Tests bleiben.
- Electron-Tests unverändert (`ELECTRON_RUN_AS_NODE=1`).

## 9. Erfolgskriterien

- Fremder Nutzer öffnet URL → leere Bibliothek, kann Einträge anlegen/bearbeiten/exportieren.
- Dieselbe URL auf anderem Browser/Gerät → andere (eigene) leere/andere Bibliothek.
- Desktop-App unberührt; Mac-DMG-Flow weiter nutzbar.
- Kein Login erforderlich.
