# Library Desk — SPD-Zip Export/Import mit Medien

**Datum:** 2026-10-07  
**Status:** Freigegeben / umgesetzt  
**Ordner:** `Library Desk` · **GitHub:** `Library-Desk`

## 1. Ziel

Export und Import als **eine Datei** ohne manuelles Entpacken: lokale **Audio- und Cover-Dateien** wandern mit. Gilt für **Bibliothek sichern** und **Eintrag-Export**. Import akzeptiert Zip und weiterhin reines JSON / Mastermind.

## 2. Entscheidungen

| Thema | Entscheidung |
|---|---|
| Container | `.spd.zip` (eine Datei; App packt/entpackt intern) |
| Metadaten | `library.json` im Zip — Desk-Format `suno-prompt-desk` / `formatVersion: 1` (+ Medien-Felder) |
| Medienpfad | `media/<entryId>/<safeFilename>` für lokales Audio und Cover |
| URL-Audio | nur URL in JSON, kein Binary |
| Geltungsbereich | Bibliothek sichern + Eintrag-Export |
| Import | `.spd.zip` **oder** `.spd.json` / Mastermind-Array |
| Plattformen | Electron (Main) + Web (JSZip o.ä.) |
| UX | keine Zwischen-Schritte; Save/Download bzw. File-Picker |

## 3. Zip-Struktur

```
archive.spd.zip
├── library.json
└── media/
    └── <entryId>/
        ├── <audio-filename>    # optional
        └── <cover-filename>    # optional
```

### library.json

- Weiterhin `format`, `formatVersion`, `exportedAt`, `entries[]`.
- Lokales Audio, wenn Binary im Zip:
  - `{ "kind": "local", "included": true, "originalName": "…", "path": "media/<entryId>/…" }`
- Lokales Audio ohne Binary (Legacy/JSON-only):
  - `{ "kind": "local", "included": false, "originalName": "…" }`
- Cover analog: `included` + optional `path`, sonst nur `originalName`.
- URL-Audio unverändert `{ kind: "url", href, label? }`.

Parser muss alte Exporte ohne `path` / `included: false` weiter lesen.

## 4. Export-Verhalten

1. Entries sammeln (alle bzw. einer).
2. Für jedes lokale Audio/Cover: Datei lesen (FS bzw. IndexedDB-Blob) und unter `media/…` in den Zip schreiben; JSON-Felder auf `included: true` + `path` setzen.
3. Fehlt die Quelldatei: `included: false` (nur Name), Eintrag trotzdem exportieren.
4. Eine `.spd.zip` speichern/downloaden.

Dateinamen-Vorschläge:
- Bibliothek: `library-desk-YYYY-MM-DD.spd.zip`
- Eintrag: aus Titelslug + `.spd.zip` (wie bisherige `entryExportFilename`, Endung `.spd.zip`)

## 5. Import-Verhalten

1. Nutzer wählt eine Datei.
2. **Zip** (Erkennung: Endung `.spd.zip` / `.zip` oder Magic): entpacken → `library.json` parsen → Medien kopieren/schreiben → Upsert Entries.
3. **JSON** Desk-Bundle oder Mastermind-Array: bisherige Logik (ohne lokale Medien-Binaries).
4. Fehlende Media-Datei im Zip → Cover/Audio am Eintrag null oder Metadaten ohne abspielbare Datei (wie bisher bei Import ohne Binary).

Upsert: bestehende ID-Semantik (created/updated Zähler).

## 6. API / UI

- `io.exportLibrary` / `io.exportEntry` liefern Zip statt reinem JSON.
- `io.importLibrary` akzeptiert Zip + JSON.
- Dialog-Filter: `spd.zip`, `zip`, `json` / `spd.json`.
- Labels unverändert: „Bibliothek sichern“, „Export“, „Import“.
- Kurznotice bei Erfolg optional: „… inkl. Medien“ wenn mindestens eine Binary mitging (nice-to-have, nicht blockierend).

## 7. Nicht-Ziele

- Passwortgeschützte Zips
- Separater „nur JSON“-Export-Button
- Cloud-Upload
- Ändern des Mastermind-Import-Formats

## 8. Erfolgskriterien

- Bibliothek mit lokalem Audio+Cover → Zip speichern → auf anderem Gerät/Browser importieren → Audio und Cover abspielbar/sichtbar.
- Eintrag-Export Zip rundtrip gleich.
- Altes `.spd.json` ohne Medien weiter importierbar.
- Kein manuelles Entpacken nötig.
