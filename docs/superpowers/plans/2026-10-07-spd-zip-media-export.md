# SPD-Zip Media Export Implementation Plan

> **For agentic workers:** Inline execution in this session.

**Goal:** Export/Import als `.spd.zip` inkl. lokaler Audio-/Cover-Dateien (eine Datei, kein manuelles Entpacken).

**Architecture:** Shared JSON-Schema mit `included`+`path`; JSZip für Pack/Unpack; Electron liest/schreibt FS; Web IndexedDB-Blobs.

**Tech:** jszip, bestehendes Desk-JSON

## Global Constraints

- Bibliothek sichern + Eintrag-Export → `.spd.zip`
- Import: zip + json + mastermind
- URL-Audio ohne Binary
- Commits nur auf Bitte
