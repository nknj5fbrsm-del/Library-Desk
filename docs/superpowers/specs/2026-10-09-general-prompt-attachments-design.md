# Library Desk — Anhänge für Allgemeine Prompts

**Datum:** 2026-10-09  
**Status:** Umsetzung  
**Ansatz:** Mehrere lokale Dateien pro `kind: general`, analog zu Audio/Cover.

## Modell

```ts
interface AttachmentRef {
  id: string
  relativePath: string
  originalName: string
}
```

- `Entry.attachments: AttachmentRef[]` (nur `general`; Suno immer `[]`)
- SQLite: `attachments_json`; Web: Feld am IndexedDB-Eintrag + Blob in `media`
- Typen: PDF, TXT, MD, DOC/DOCX, RTF, CSV, JSON, HTML, ODT

## UX

- Editor-Accordion „Anhänge“ nur bei Allgemeinen Prompts
- Hinzufügen (Mehrfachwahl), Liste mit Name, Öffnen/Speichern, Entfernen
- Kein URL-Anhang (nur lokale Dateien)

## Persistenz / Export

- Electron: `userData/attachments/<entryId>/<id>__<name>`
- Web: `attachment:<entryId>:<attachmentId>` in Media-Store
- SPD-Zip: `attachments[]` mit `included`/`path` wie Cover; Import stellt Blobs wieder her
- Duplizieren / Version: Dateien mitkopieren
