# Library Desk — App-Icon & Packaging Design

**Datum:** 2026-10-05  
**Status:** Freigegeben / in Umsetzung  
**Produktname:** Library Desk  
**Ordner:** `Library Desk` · **GitHub:** `Library-Desk` · **npm:** `suno-prompt-desk`

## 1. Ziel

App-Icon und Installationspakete für macOS und Windows, damit Library Desk als Desktop-App verteilt werden kann (nicht nur `npm run dev`).

## 2. Icon

| Thema | Entscheidung |
|---|---|
| Motiv | Vertikale Liste (3–4 Zeilen) mit kleinen Noten-Symbolen links |
| Farbe | Blau→Weiß-Verlauf (Hellblau oben → Weiß unten); Listenlinien in dunklerem Blau |
| Stil | Flach, minimal, Squircle/abgerundetes App-Icon; kein Text, kein 3D, kein Glow |
| Master | `build/icon.png` (1024×1024) |
| Abgeleitete Formate | `.icns` (macOS), `.ico` (Windows) — via electron-builder bzw. Hilfsskript |

## 3. Packaging

| Thema | Entscheidung |
|---|---|
| Tool | `electron-builder` |
| App-ID | `com.librarydesk.app` (oder gleichwertig) |
| Produktname | Library Desk |
| macOS | `.dmg` |
| Windows | NSIS `.exe` |
| Native Module | `better-sqlite3` — rebuild beim Pack (`@electron/rebuild` / electron-builder) |
| Scripts | `dist` / `dist:mac` / `dist:win` |
| Output | `release/` (gitignored) |

### Hinweise

- Mac-Build lokal auf diesem Mac.
- Win-Build **nur** auf Windows oder in CI (`dist:win`, NSIS x64): `better-sqlite3` cross-kompiliert nicht von macOS; ein macOS-erzeugter `.exe` ist kein gültiges Ship-Artefakt.
- Fenster-Icon in Electron auf das gebaute Icon setzen (Main-Process / electron-builder default).

## 4. Nicht-Ziele

- Auto-Update / Code-Signing (später optional)
- Linux-Pakete (AppImage/deb) in diesem Schritt
- Store-Submission (Mac App Store / Microsoft Store)

## 5. Erfolgskriterien

- App-Icon sichtbar im Dock (Mac) und als `.exe`-Icon (Win)
- `npm run dist:mac` erzeugt lauffähiges `.dmg`
- `npm run dist:win` auf Windows/CI erzeugt lauffähigen x64-Installer; Cross-Build von macOS ist ausgeschlossen (README)
