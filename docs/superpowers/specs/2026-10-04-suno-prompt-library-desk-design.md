# Suno Prompt Library Desk — Design Spec

**Datum:** 2026-10-04  
**Status:** Freigegeben  
**Produktname:** Library Desk  
**Repo-/Ordnername:** `suno-prompt-desk`  
**Pfad:** `~/Desktop/Cursor Projekte/suno-prompt-desk`

## 1. Ziel

Eigenständige Desktop-App (Electron) als **Pflege-Arbeitsplatz** für Suno Style-/Lyrics-Prompts: anlegen, versionieren, taggen, suchen, aufräumen. Copy Style/Lyrics und Audio-Wiedergabe sind wichtig, aber sekundär.

Nicht Ziel: die gesamte Suno-Mastermind-Pipeline, Cloud-Sync oder Multi-User im MVP.

### Zielgruppe & Ausblick

- Primär: Einzelperson (lokal).
- Architektur so, dass später andere Suno-Nutzer und Multi-Device möglich sind (sauberes Datenmodell, Export/Import zuerst; Sync optional später).

### Verhältnis zu Suno Mastermind

- **Eigenständig.** Mastermind behält seine eigene Bibliothek.
- Mastermind-Code wird **nicht** angefasst und nicht als UI 1:1 extrahiert.
- Brücke später über Import/Export (optional Sync) — **nicht MVP**.
- Mastermind-Referenz nur zum Lesen (Datenideen): `…/Suno Mastermind/suno-mastermind-workflow-3/` (`PromptLibraryPanel`, `promptLibrary/*`, `useSongLibrary`, `promptLibrary*.ts`).

## 2. Produktentscheidungen (verbindlich)

| Thema | Entscheidung |
|---|---|
| Plattform | Electron-Desktop (.dmg/.exe später); kein Web-MVP zuerst |
| Daten MVP | Nur lokal auf dem Gerät |
| Teilen MVP | Export/Import |
| Startzustand | Leere Bibliothek ok |
| Mastermind-Import | Phase 2 |
| UX-Ansatz | Neues Gerüst „Library Desk“, nicht Mastermind-Extrakt |
| Persistenz | SQLite im Main-Process + Audio-Dateien unter `userData` |
| Lokales Audio | Kopie in App-Datenordner (kein reiner Fremdpfad) |
| Export Audio | URLs immer; lokale Binaries **nicht** im JSON-MVP |

## 3. Scope

### 3.1 MVP — drin

- Electron-Shell + React + TypeScript (Vite)
- Lokale Persistenz: SQLite (`library.db`) + Ordner `audio/`
- Split-UI: Liste links, Detail/Editor rechts
- Eintrag: Titel, Style-Prompt, Lyrics (optional leer = Instrumental), Notizen, Tags, Power-Flag, `createdAt` / `updatedAt`
- Versionen in einer Gruppe („Version anlegen“)
- Suche + Filter (Alle / Power / Tags) + Sortierung (Neueste / A–Z / Zuletzt geändert)
- Anlegen, Duplizieren, Umbenennen, Löschen (mit Bestätigung)
- Copy Style / Copy Lyrics / Beides
- Export/Import eigenes JSON-Format (dokumentiert)
- DE-UI (EN später ok)
- Desktop-Shortcuts wo sinnvoll
- Audio optional pro Eintrag: lokal + URL; Mini-Player in Detail; Audio-Hinweis in Liste; ein Play gleichzeitig

### 3.2 MVP — raus (Phase 2+)

- Mastermind-JSON-Import / Deep-Link in Mastermind
- Cloud-Sync / Accounts
- Mashup-Pipeline, Cover, Idee/Details-Pipeline, Gemini
- Multi-User-Sharing live
- Waveform-Editor, DJ-Features, Playlist-Mix, Offline-Download ganzer Suno-Seiten
- Code-Signing/Notarisierung (darf vorbereitet sein, blockiert MVP nicht)
- Zip-Bundle-Export inkl. lokaler Audio-Dateien

## 4. Architektur-Ansätze (gewählt)

Verglichen:

1. **JSON + Medienordner** — schnell, aber Suche/Versionen nur im Speicher.
2. **SQLite (Main) + Medienordner** — gewählt: strukturierte Pflege, Tags/Suche/Versionen, später Sync-freundlicher.
3. **Nur JSON, Audio nur URL/Pfad** — zu schwach für lokale Dateien.

**Gewählter Stack**

- Electron + Vite + React + TypeScript
- Main: SQLite via `better-sqlite3`, Datei-I/O (Audio-Copy, Export/Import), `shell.openExternal`
- Preload: `contextBridge` API (kein Node im Renderer)
- Renderer: UI + HTMLAudioElement-Player

## 5. UX — Library Desk

### 5.1 Layout

Eine ruhige Arbeitsfläche, kein Dashboard:

```
┌──────────────────────────────────────────────────────────┐
│ Menü / Toolbar (Neu, Suche, Import/Export)               │
├────────────────────┬─────────────────────────────────────┤
│ Liste              │ Detail / Editor                     │
│ - Gruppe + Chips   │ Titel, Power, Tags                  │
│ - Audio-Icon       │ Style / Lyrics / Notizen            │
│ - Power-Markierung │ Versionen · Copy · Mini-Player      │
└────────────────────┴─────────────────────────────────────┘
```

### 5.2 Interaktion

- Wenig Modals: Schnellanlage bevorzugt; Bestätigung für Löschen; nach Import kurze Zusammenfassung (erstellt/aktualisiert).
- Autosave bei Feldänderungen (debounce) + explizites Speichern-Shortcut (Cmd/Ctrl+S) als Sicherheit.
- Shortcuts (MVP): Neu, Suche fokussieren, Style kopieren, Lyrics kopieren, Beides kopieren, Löschen (mit Bestätigung).
- Sprache: Deutsch.

### 5.3 Versionen (UX)

- Liste gruppiert nach `groupId`; Anzeige Gruppen-Titel + Versions-Chips (V1, V2, …).
- „Version anlegen“: Kopie des aktuellen Eintrags als nächste Versionsnummer in derselben Gruppe.
- „Duplizieren“: neuer Eintrag / neue Gruppe (kein Sibling).
- Badge nur wenn Gruppe ≥ 2 Einträge hat. Nach Löschen mit genau einem Verbleibenden: Badge ausblenden; `groupId`/`version` dürfen in der DB bleiben.

## 6. Datenmodell

Lean, an Suno-Prompts angelehnt, **nicht** an Mastermind-Pipeline-Typen gekoppelt. Keine Mashup-/Cover-/Gemini-Felder im MVP.

### 6.1 Entry

| Feld | Typ | Notes |
|---|---|---|
| `id` | string (UUID) | Primärschlüssel |
| `groupId` | string (UUID) | Versionsgruppe; Solo = eigene groupId |
| `version` | integer ≥ 1 | innerhalb der Gruppe |
| `title` | string | Trim; leer wird als „Ohne Titel“ gespeichert |
| `stylePrompt` | string | |
| `lyrics` | string | leer erlaubt (Instrumental) |
| `notes` | string | |
| `tags` | string[] | normalisiert trim; Match case-insensitive |
| `isPower` | boolean | „Power“-Flag (entspricht fachlich Favorite/Power in Mastermind-Idee) |
| `createdAt` | epoch ms (DB) | festgelegt bei Create; Export als ISO-8601 |
| `updatedAt` | epoch ms (DB) | bei jeder Änderung; Export als ISO-8601 |
| `audio` | AudioRef \| null | optional |

### 6.2 AudioRef

```ts
type AudioRef =
  | {
      kind: 'local';
      /** Relativer Key unter userData/audio/<entryId>/ */
      relativePath: string;
      originalName: string;
    }
  | {
      kind: 'url';
      href: string;
      label?: string;
    };
```

Runtime-Status (nicht zwingend persistiert): `ok` | `missing` | `unplayable`.

### 6.3 Persistenzpfade

- DB: `<userData>/library.db`
- Audio: `<userData>/audio/<entryId>/<safeFilename>`
- Beim Anhängen lokaler Dateien: **Kopie** nach `audio/…` (Quelle darf danach verschwinden).
- Beim Löschen eines Eintrags: zugehörige Audio-Dateien entfernen.
- Einstellungen (Sortierung, Lautstärke): SQLite-Tabelle `settings` (key/value).

## 7. Features — Verhalten

### 7.1 Suche / Filter / Sort

- Suche: Volltext über Titel, Style, Lyrics, Notes, Tags (case-insensitive).
- Filter: Alle | Power | nach Tag (mindestens ein Tag-Filter).
- Sort: Neueste (`createdAt` desc) | A–Z (`title`) | Zuletzt geändert (`updatedAt` desc).

### 7.2 CRUD

- Anlegen: neuer Eintrag, `version = 1`, neue `groupId`.
- Duplizieren: neuer Eintrag, neue Gruppe, Inhalte kopiert; lokales Audio optional mitkopieren (Default: ja, eigene Dateikopie).
- Umbenennen: Titel im Detail editierbar.
- Löschen: Bestätigungsdialog; entfernt DB-Zeile + lokale Audio-Dateien; Versions-Singleton-Bereinigung wie in 5.3.

### 7.3 Copy

- Style / Lyrics / Beides → System-Clipboard.
- „Beides“-Clipboard-Format (verbindlich):

```
<stylePrompt>

---

<lyrics>
```

### 7.4 Audio

- Quellen: lokal (File-Picker → Kopie) oder URL.
- Mini-Player nur in Detail: Play/Pause, Fortschritt, Dauer, Lautstärke.
- Genau ein aktiver Play: neuer Start stoppt vorherigen.
- Liste: dezentes Icon, wenn `audio` gesetzt.
- URL nicht abspielbar (CORS/Format/HTML-Seite): verständlicher Hinweis + Aktion „Im Browser öffnen“.
- Lokale Datei fehlt: Hinweis + Neu anhängen.

## 8. Export / Import-Format

### 8.1 Datei

- Dateifilter-Default: `.spd.json`; Import akzeptiert auch `.json`, solange `format === "suno-prompt-desk"`.
- Erkennung über Feld `format` (+ `formatVersion`).

### 8.2 Schema v1

```json
{
  "format": "suno-prompt-desk",
  "formatVersion": 1,
  "exportedAt": "2026-10-04T12:00:00.000Z",
  "entries": [
    {
      "id": "uuid",
      "groupId": "uuid",
      "version": 1,
      "title": "Beispiel",
      "stylePrompt": "...",
      "lyrics": "...",
      "notes": "...",
      "tags": ["tag"],
      "isPower": false,
      "createdAt": "2026-10-04T11:00:00.000Z",
      "updatedAt": "2026-10-04T11:30:00.000Z",
      "audio": {
        "kind": "url",
        "href": "https://example.com/track.mp3",
        "label": "optional"
      }
    }
  ]
}
```

### 8.3 Audio in Export/Import

- `kind: "url"`: vollständig exportieren/importieren.
- `kind: "local"`: nur Metadaten, **keine** Binaries:

```json
"audio": {
  "kind": "local",
  "included": false,
  "originalName": "demo.mp3"
}
```

- Import lokaler Audio-Metadaten: Eintrag ohne abspielbare lokale Datei; UI zeigt „Audio nur auf Quellgerät“ / Neu anhängen.
- **Import-Default:** Upsert bei gleicher `id`, sonst Insert. Gruppen (`groupId` / `version`) bleiben erhalten.

## 9. Architektur-Skizze

```
electron-main
  ├── db (SQLite)
  ├── audioFs (copy/delete)
  ├── importExport
  └── ipc handlers

preload (contextBridge)

renderer (React)
  ├── LibraryList
  ├── EntryEditor
  ├── MiniPlayer
  └── hooks/stores → window.desk API
```

IPC-Oberfläche schmal und typisiert (z. B. `entries.list/get/create/update/delete`, `audio.attachLocal/clear`, `io.export/import`, `shell.openExternal`).

## 10. Dev-Start & Workspace

- Workspace = **nur** `suno-prompt-desk` (nicht Elternordner „Cursor Projekte“).
- Dev-Befehl (nach Scaffold): typisch `npm run dev` (Vite + Electron).
- Preview: Electron-Fenster (kein Browser-URL als Primärziel).
- Auto-Start-Task analog anderer Desktop-Projekte dokumentieren (`.vscode/tasks.json` mit `runOn: folderOpen`).

## 11. Erfolgskriterium

Lokal starten; Einträge anlegen/versionieren/taggen/suchen/löschen; Style/Lyrics kopieren; Export/Import-Rundtrip; Audio lokal oder per URL abspielen — UI klarer und ruhiger als die eingebettete Mastermind-Bibliothek.

## 12. Nächste Schritte nach Spec-Freigabe

1. Implementierungsplan (`docs/superpowers/plans/…`) via writing-plans.
2. Scaffold Electron+Vite+React+SQLite.
3. MVP-Features in sinnvollen Vertical Slices bauen und verifizieren.
