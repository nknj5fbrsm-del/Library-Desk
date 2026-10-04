# Library Desk

Lokale Suno-Prompt-Bibliothek als Electron-App.

## Workspace

Diesen Ordner (`suno-prompt-desk`) als eigenen Workspace öffnen — nicht den Elternordner „Cursor Projekte“. Beim Öffnen startet `npm run dev` über die VS-Code-Aufgabe. Es öffnet sich ein Electron-Fenster (kein Browser-URL).

## Start

```bash
npm install
npx electron-rebuild -f -w better-sqlite3
npm run dev
```

`better-sqlite3` muss zur Electron-ABI passen. Nach einem Wechsel von Electron oder Node den Rebuild wiederholen.

Weitere Skripte: `npm run build`, `npm run preview`.

## Tests

```bash
npm test
```

Vitest läuft unter Electron (`ELECTRON_RUN_AS_NODE=1`), damit `better-sqlite3` dieselbe ABI wie die App nutzt. Watch-Modus: `npm run test:watch`.

## Export / Import

Export schreibt `.spd.json` mit `format: "suno-prompt-desk"` und `formatVersion: 1`. URL-Audio wird vollständig übernommen, lokale Audiodateien nur als Metadaten ohne Binärdaten. Schema: Spec, Abschnitt 8.

Import akzeptiert:
- Desk-Bundle (`format: "suno-prompt-desk"`)
- **Suno-Mastermind**-JSON (Array von Bibliothekseinträgen, z. B. Export aus der Mastermind-Bibliothek)

Nicht mappbare Mastermind-Felder (Pipeline, Mashup, Rating …) werden verworfen. Einträge ohne Style und ohne Lyrics werden übersprungen. Cover-Data-URLs werden nach `userData/covers/` kopiert und in Liste/Detail angezeigt.

## Spec und Plan

- Spec: `docs/superpowers/specs/2026-10-04-suno-prompt-library-desk-design.md`
- Plan: `docs/superpowers/plans/2026-10-04-suno-prompt-library-desk.md`
