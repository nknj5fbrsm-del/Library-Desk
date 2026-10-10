# Library Desk — Automatisches Zip-Backup

**Datum:** 2026-10-10  
**Status:** Freigegeben / umgesetzt  
**Ordner:** `Library Desk` · **GitHub:** `Library-Desk`  
**Baut auf:** `2026-10-07-spd-zip-media-export-design.md` (Format `.spd.zip` unverändert)

## 1. Ziel

Die komplette Bibliothek regelmäßig als **`.spd.zip`** (inkl. lokaler Medien) in einen vom Nutzer gewählten Ordner schreiben — ohne Save-Dialog, ohne manuelles „Bibliothek sichern“.

Erfolg: Nach Aktivierung liegen zu den geplanten Zeiten (bzw. beim Nachholen) Dateien wie `library-desk-backup-2026-10-10-0300.spd.zip` im Backup-Ordner; alte Dateien werden rotiert.

## 2. Geltungsbereich

| Drin | Raus |
|------|------|
| **Mac / Electron** — geplantes Auto-Backup | **Web / Vercel** — kein Auto-Backup (Browser); manueller Button bleibt |
| Voll-Bibliothek als `.spd.zip` (gleicher Builder wie „Bibliothek sichern“) | Mastermind, Pendel, andere Apps |
| Einstellungen: an/aus, Uhrzeit, Zielordner, Aufbewahrung | Cloud-Upload, iCloud-Pflicht, Sync zwischen Geräten |
| Nachholen, wenn die App zur geplanten Zeit nicht lief | Backup bei geschlossener App ohne laufenden Prozess (kein `launchd` im MVP) |
| Dezentes UI-Feedback (letzter Erfolg / Fehler) | Eigenes Backup-Dateiformat |

**Begründung Web raus:** Kein zuverlässiger stiller Schreibzugriff auf einen festen Ordner; Download-Dialog wäre kein echtes Auto-Backup.

## 3. Entscheidungen

| Thema | Entscheidung |
|-------|----------------|
| Format | Bestehende **`.spd.zip`**-Pipeline (`buildSpdZipBuffer` / Shared Zip) — Format-ID `suno-prompt-desk` bleibt |
| Trigger | Täglich zu einer **lokalen Uhrzeit** (Default **03:00**) |
| Voraussetzung | Library Desk **läuft** (Fenster offen oder als App aktiv). Zusätzlich: **Catch-up beim Start**, wenn seit dem letzten erfolgreichen Auto-Backup ≥ 1 geplanter Slot verpasst wurde |
| Zielordner Default | `~/Documents/Library Desk Backups` (wird bei Bedarf angelegt) |
| Zielordner wählbar | Ja — Ordner-Picker in Einstellungen; Pfad in User-Settings persistieren |
| Dateiname | `library-desk-backup-YYYY-MM-DD-HHmm.spd.zip` |
| Rotation | Default **14** neueste Auto-Backup-Dateien behalten; ältere Auto-Backups im Zielordner löschen (nur Dateien mit Prefix `library-desk-backup-`) |
| Manuelles „Bibliothek sichern“ | Unverändert (Save-Dialog); zählt **nicht** zur Auto-Rotation |
| Überlappung | Wenn ein Backup noch läuft, keinen zweiten Start; nächsten Slot normal planen |
| Leere Bibliothek | Trotzdem Backup schreiben (gültiges leeres/minimales Zip laut bestehendem Export) |
| Fehler | Toast/Status „Backup fehlgeschlagen“ + letzter Fehlertext in Settings; App nicht crashen |
| Default aktiv? | **Aus** — Nutzer schaltet Auto-Backup einmal ein und bestätigt ggf. Ordner |

## 4. Architektur

Nur **Main-Prozess** schreibt Dateien (wie bisheriger Export).

```
Renderer (Settings / Status)
    │  DeskApi: getAutoBackupSettings / set… / runAutoBackupNow?
    ▼
Main: autoBackup.ts
    ├── Settings lesen/schreiben (electron-store oder JSON in userData)
    ├── Scheduler: setTimeout bis nächster Slot + optional interval check
    ├── onAppReady / did-finish-load: catch-up prüfen
    ├── runAutoBackup():
    │     list entries → buildSpdZipBuffer → writeFile(ziel)
    │     → rotateAutoBackups(ziel, keepN)
    │     → lastSuccessAt / lastError aktualisieren
    └── IPC Events → Renderer (optional: „Zuletzt gesichert …“)
```

Bestehende manuelle Route `io:exportLibrary` (Dialog) bleibt; Auto-Backup ruft intern denselben Zip-Builder auf und schreibt **direkt** nach `path.join(folder, filename)`.

### Settings-Shape (Vorschlag)

```ts
type AutoBackupSettings = {
  enabled: boolean
  /** Minuten seit Mitternacht lokal, 0–1439; Default 180 (= 03:00) */
  timeMinutes: number
  folderPath: string
  retainCount: number // Default 14, Min 1, Max 90
  lastSuccessAt: string | null // ISO
  lastError: string | null
  lastAttemptAt: string | null // ISO
}
```

Persistenz: `userData` (z. B. `auto-backup.json` neben der DB), nicht in der Song-DB.

## 5. Scheduler-Verhalten

1. **App startet:** Settings laden. Wenn `enabled`:
   - Wenn Catch-up nötig (kein erfolgreiches Auto-Backup seit dem letzten fälligen Slot) → einmal `runAutoBackup()`.
   - Timer bis zum **nächsten** heutigen/morgigen `timeMinutes` setzen.
2. **Timer feuert:** `runAutoBackup()`, danach nächsten Slot planen.
3. **Settings ändern** (Zeit/Ordner/an-aus): Timer neu setzen; bei „aus“ Timer clearen.
4. **Manuell „Jetzt sichern“** (optional in Settings): gleicher `runAutoBackup()`, ohne Save-Dialog — hilfreich zum Testen.

Catch-up-Regel (eindeutig):  
`enabled && (lastSuccessAt == null || lastSuccessAt < startOfLastDueSlot)` → nachholen.  
Höchstens **ein** Catch-up pro App-Start (kein Burst für viele verpasste Tage).

## 6. UX

- Einstellungen-Bereich (bestehende Settings-UI erweitern oder kleiner Dialog unter Toolbar-Menü):
  - Schalter **Automatisches Backup**
  - Uhrzeit (lokale Zeit)
  - Ordner + „Ordner wählen…“
  - „Behalten: N Dateien“
  - Statuszeile: Zuletzt erfolgreich / Letzter Fehler
  - Button **Jetzt sichern** (still in den Auto-Ordner)
- Toolbar **„Bibliothek sichern“** bleibt manuell mit Dialog.
- Kein modaler Blocker beim Auto-Lauf; bei Fehler kurzer Toast.

Texte DE, kompakt.

## 7. Fehler & Kantenfälle

| Fall | Verhalten |
|------|-----------|
| Ordner nicht beschreibbar | Fehler speichern, Toast, Timer läuft weiter (nächster Versuch) |
| Zip-Bau schlägt fehl | wie oben; keine halbe Datei liegen lassen (temp + rename) |
| Festplatte voll | Fehler melden |
| App zur Backup-Zeit im Sleep | Beim nächsten Wecken/Start: Catch-up |
| Nutzer löscht Ordner | Beim Schreiben neu anlegen wenn möglich, sonst Fehler |

Schreiben atomar: zuerst `*.spd.zip.tmp` / temp-Name, dann rename auf finalen Namen.

## 8. Tests

- Unit: nächster Slot aus `timeMinutes` + „jetzt“; Catch-up-Bedingung; Rotation behält nur Prefix-Dateien und max N.
- Integration (Main/Fake-FS): `runAutoBackup` erzeugt Zip, das `parseExportBundle` / Unpack akzeptiert; zweiter Lauf rotiert.
- Manueller Export-Dialog unverändert (kein Regress).

## 9. Nicht-Ziele / später

- `launchd` / Login-Item für Backup bei komplett geschlossener App  
- Web Auto-Download  
- Verschlüsselte Backups  
- Upload zu iCloud/Drive als eigene Feature-Schicht (Ordner kann der Nutzer selbst in iCloud legen)

## 10. Implementierungs-Hinweis (Dateien)

| Neu / ändern | Rolle |
|--------------|--------|
| `src/main/autoBackup.ts` | Scheduler, Run, Rotation, Settings IO |
| `src/main/ipc.ts` + `preload` + `deskApi` | Settings + optional run-now |
| `src/renderer` Settings-UI | Schalter, Zeit, Ordner, Status |
| `tests/autoBackup*.test.ts` | Slot, Catch-up, Rotation |
| HANDOFF / README | Kurz dokumentieren |

Geschätzter Aufwand: ein fokussierter Feature-Slice nach Freigabe dieser Spec.

## 11. Umsetzungshinweise (Stand)

Umgesetzt in App: Scheduler + Catch-up, Settings-Dialog (Toolbar **Auto-Backup**), Rotation, Web-Stub `isAvailable: false`. Defaults wie in Abschnitt 3.
