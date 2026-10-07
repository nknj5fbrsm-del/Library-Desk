# Library Desk — Mobile Master-Detail

**Datum:** 2026-10-07  
**Status:** Freigegeben (Ansatz A)  
**Ziel:** Web-/schmale Viewports nutzbar machen ohne Desktop-Split zu ändern.

## 1. Ziel

Auf Smartphones (schmale Viewports) ist die Bedienung suboptimal: Liste und Detail teilen sich die Breite, Toolbar und Touch-Targets sind desktop-lastig. Die App soll parallel für Smartphones angepasst werden — vollständige Mobile-Navigation inkl. kompakter Toolbar und handlicher Editor-Fläche.

Nicht Ziel: Native App, eigene Mobile-Codebasis, Desktop-UX umbauen.

## 2. Ansatz (gewählt)

**A — Master-Detail-Stack** unter Breakpoint ~768px:

1. Start: Liste Vollbreite
2. Auswahl / Neu → Detail Vollbreite mit Zurück
3. Desktop (≥768px): unverändertes Split inkl. Resizer

Verworfen: B (nur CSS stapeln), C (eigene Mobile-Shell).

## 3. Verhalten

| Thema | Entscheidung |
|---|---|
| Breakpoint | `max-width: 767.98px` (CSS + `matchMedia`) |
| State | `mobilePane: 'list' \| 'detail'` nur im Mobile-Modus relevant |
| Auswahl | `select` → Pane `detail` |
| Neu | nach `createNew` → Pane `detail` |
| Zurück | Pane `list`; Auswahl bleibt (Highlight in Liste) |
| Browser-Zurück (Web) | `history.pushState` / `popstate` spiegelt Pane, wo sinnvoll |
| Resize ≥768 | Desktop-Split; Pane-State wird nicht angezeigt |
| Resize &lt;768 mit Auswahl | Detail sichtbar, wenn Auswahl existiert, sonst Liste |
| Resizer | auf Mobile ausgeblendet / nicht bedienbar |

## 4. UI-Anpassungen

### Toolbar

- Erste Zeile: Suche (breit), **Neu**, Toggle „Filter“
- Eingeklappt: Filter/Tag/Sort + Import / Bibliothek sichern
- Touch-Targets ≥44px Höhe wo Buttons/Selects betroffen

### Detail

- Sticky/oben: Zurück-Button („Bibliothek“ / Chevron)
- Cover + Titel stapeln bei Bedarf; Cover kleiner
- Action-Buttons umbrechen, volle Breite wo sinnvoll
- Weniger Padding; Textareas nutzbar mit Soft-Keyboard

### Liste

- Größere Zeilen / Delete-Hit-Area
- Kein Split-Anteil mehr

## 5. Architektur

- Logik in `App.tsx` (+ kleiner Hook `useMobileLayout` optional)
- Klassen am Root: `is-mobile`, `is-list-pane` / `is-detail-pane`
- Styles in `styles.css` unter `@media (max-width: 767.98px)`
- Toolbar erhält `filtersOpen` / Collapse-Props
- Keine Router-Library; History nur leichtgewichtig für Web-Zurück

## 6. Tests / Abnahme

- Desktop-Split unverändert (≥768)
- Mobile: Liste → Eintrag → Detail → Zurück → Liste
- Neu öffnet Detail
- Toolbar-Filter einklappbar
- `npm test` und `npm run build:web` grün
