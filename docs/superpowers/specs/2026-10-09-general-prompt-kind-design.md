# Library Desk — Allgemeine Prompts (Entry Kind)

**Datum:** 2026-10-09  
**Status:** Umsetzung  
**Ansatz:** Ein Katalog, Filter Art = Alle / Suno / Allgemein; Neu wählt den Typ.

## Felder `kind: general`

| Feld | UI-Label | Zweck |
|---|---|---|
| `promptBody` | Prompt | Haupttext |
| `systemRole` | Rolle / System | optionale System-/Rollenanweisung |
| `usageGuide` | Anwendung | wie der Prompt arbeitet, was er macht, wie anwenden |
| gemeinsam | Titel, Tags, Sterne, Notizen, Versionen | wie Suno |

Suno behält Style/Lyrics/Audio/Cover/Veröffentlicht. Bestehende Einträge: `kind = suno`.

## UX

- Toolbar-Select „Art“
- Dialog bei Neu: Suno-Prompt | Allgemeiner Prompt
- Liste: kleines Art-Badge; Cover nur bei Suno
- Editor und Copy-Buttons je nach Kind
