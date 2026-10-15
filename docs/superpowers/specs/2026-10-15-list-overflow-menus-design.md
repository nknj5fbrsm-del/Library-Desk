# Library Desk — Listen-Overflow-Menüs & Versions-Export

**Datum:** 2026-10-15  
**Status:** Umsetzung  
**Freigabe:** Nutzer — Menü wie spezifiziert, Bulk Export+Löschen

## 1. Pro-Zeile ⋯

Ersetzt/ergänzt den direkten Papierkorb. Aktionen (am repräsentativen bzw. selektierten Versions-Eintrag):

- Beim Öffnen von ⋯ wird dieser Eintrag aktiv (Detail wechselt mit)
- Duplizieren, Export, Löschen
- Copy: Style/Lyrics/Beides bzw. Prompt/Rolle/Anwendung/Alles (nach `kind`)

## 2. Listen-Kopf (links über der Eintragsliste)

- **Neu** + **Auswählen** (direkte Buttons, kein globales ⋯)
- Im Auswahlmodus: Zähler + **Export**, **Löschen**, **Abbrechen**

Bulk-Löschen: alle Versionen der ausgewählten Gruppen.  
Bulk-Export: ein Zip mit allen Versionen der ausgewählten Gruppen.

## 3. Export-Versionen

`exportEntry(id)` und Bulk exportieren alle Einträge derselben `groupId` (`collectEntriesForExport`).
