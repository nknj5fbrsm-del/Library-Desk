# Publish-Status & Publish-Links

Datum: 2026-10-05  
Projekt: Library Desk (npm/`format`: `suno-prompt-desk`)

## Ziel

Einträge als veröffentlicht markieren und mehrere externe Publish-Links (YouTube, Spotify, SoundCloud, …) speichern. Checkbox steuert Sichtbarkeit der Link-UI; vorhandene Links bleiben beim Abhaken erhalten. Zusätzlicher Listenfilter „Veröffentlicht“.

## Datenmodell

Pro `Entry`:

- `published: boolean` (Default `false`)
- `publishLinks: PublishLink[]` (Default `[]`)

```ts
interface PublishLink {
  id: string
  label: string  // frei, z. B. "YouTube"
  href: string   // URL
}
```

- `id` stabil pro Zeile (für React-Keys / Entfernen).
- Leere `href` nach Trim werden beim Speichern verworfen (oder Zeile ohne gültige URL nicht persistiert).
- Keine Plattform-Enums — Label frei.

## Persistenz

- SQLite: Spalten `published INTEGER NOT NULL DEFAULT 0`, `publish_links_json TEXT NOT NULL DEFAULT '[]'`.
- Migration via vorhandenem `ALTER TABLE`-Muster in `db.ts`.
- `CreateEntryInput` / `UpdateEntryPatch` / Repo-Serialisierung erweitern.
- Desk-Export/Import: Felder mitlesen; fehlende Werte → `false` / `[]`.
- Mastermind-Import: keine Publish-Felder → Defaults.

## Editor-UI

- Checkbox „Veröffentlicht“ nahe Meta/Sterne (Editor-Kopf oder unter Tags — konsistent mit bestehendem Editor-Flow).
- Wenn `published === true`:
  - Liste der Links: Label-Input, URL-Input, Entfernen-Button.
  - Button „+ Link“ (neue leere Zeile).
  - Optional pro Zeile „Öffnen“ (`shell.openExternal`), nur wenn `href` gültig wirkt.
- Wenn `published === false`: Link-UI ausgeblendet; `publishLinks` bleiben im Draft/DB.
- Änderungen: Draft + Undo-Stack wie Tags/Rating; Autosave unverändert.

## Listenfilter

- `LibraryFacet` um `'published'` erweitern (neben `'all' | 'rated' | { tag }`).
- Toolbar: Facet-Option „Veröffentlicht“ → nur Einträge mit `published === true`.
- Suche/Sort bleiben orthogonal.

## Nicht in Scope (v1)

- Plattform-Favicons / Auto-Erkennung aus URL
- Mehrere Insights/Statistiken zu Publish
- Sync mit externen APIs

## Akzeptanz

1. Checkbox an → Linkliste sichtbar; Links hinzufügen/entfernen/speichern.
2. Checkbox aus → Liste weg; nach erneutem An wieder dieselben Links.
3. Filter „Veröffentlicht“ zeigt nur markierte Einträge.
4. Export → Re-Import erhält Flag + Links.
