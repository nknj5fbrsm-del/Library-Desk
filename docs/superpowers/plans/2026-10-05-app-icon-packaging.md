# App-Icon & Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App-Icon (Liste + Noten, Blau→Weiß) und Installer für macOS (`.dmg`) und Windows (NSIS `.exe`) via electron-builder.

**Architecture:** Master-PNG unter `build/`, electron-builder erzeugt `.icns`/`.ico` und Pakete nach `release/`. Main-Process setzt Dock-/Fenster-Icon aus demselben Asset. `better-sqlite3` wird beim Pack neu gebaut.

**Tech Stack:** Electron 33, electron-vite, electron-builder, better-sqlite3, GenerateImage (Icon-Master)

## Global Constraints

- Produktname: Library Desk
- App-ID: `com.librarydesk.app`
- Icon-Motiv: vertikale Liste mit Noten, Blau→Weiß-Verlauf, flach, kein Text
- Targets: macOS `.dmg`, Windows NSIS `.exe`
- Output-Ordner: `release/` (gitignored)
- Kein Code-Signing, kein Auto-Update, kein Linux in diesem Schritt
- Commits nur auf explizite Nutzerbitte

---

## File Structure

| Path | Role |
|---|---|
| `build/icon.png` | 1024×1024 Master-Icon |
| `build/icon.icns` / `build/icon.ico` | Optional; electron-builder kann aus PNG ableiten |
| `package.json` | `build` config + `dist*` scripts + electron-builder dep |
| `.gitignore` | `release/` |
| `src/main/index.ts` | `icon` an BrowserWindow / Dock |
| `README.md` | Kurz: Dist-Befehle |

---

### Task 1: App-Icon Master erzeugen

**Files:**
- Create: `build/icon.png`

**Interfaces:**
- Produces: 1024×1024 PNG at `build/icon.png` for electron-builder `directories.buildResources` / `icon`

- [ ] **Step 1: Ordner anlegen**

```bash
mkdir -p build
```

- [ ] **Step 2: Icon generieren (GenerateImage)**

Description (EN für Tool):

> App icon, 1024x1024 feel, rounded squircle. Soft blue-to-white vertical gradient background (light sky blue at top to white at bottom). Flat minimal design: three or four horizontal list rows in darker blue, each with a small music note glyph on the left and a short line to the right suggesting a list entry. No text, no 3D, no glow, no photorealism. Clean vector-like library desk icon, high contrast, readable at small sizes.

Filename: `icon.png`, aspect_ratio: `1:1`

- [ ] **Step 3: Asset nach `build/icon.png` legen**

Falls GenerateImage woanders speichert: Datei nach `build/icon.png` kopieren/verschieben.

- [ ] **Step 4: Visuell prüfen**

Icon öffnen; Motiv „Liste + Noten“, Blau→Weiß, kein Text.

---

### Task 2: electron-builder konfigurieren

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `README.md` (kurze Dist-Hinweise)

**Interfaces:**
- Consumes: `build/icon.png`
- Produces: npm scripts `dist`, `dist:mac`, `dist:win`; builder config in `package.json`

- [ ] **Step 1: electron-builder installieren**

```bash
npm install -D electron-builder
```

- [ ] **Step 2: `package.json` erweitern**

Felder setzen (bestehende scripts/deps behalten):

```json
{
  "name": "suno-prompt-desk",
  "version": "0.1.0",
  "private": true,
  "description": "Library Desk — lokale Suno-Prompt-Bibliothek",
  "author": "Library Desk",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "ELECTRON_RUN_AS_NODE=1 electron ./node_modules/vitest/vitest.mjs run",
    "test:watch": "ELECTRON_RUN_AS_NODE=1 electron ./node_modules/vitest/vitest.mjs",
    "dist": "npm run build && electron-builder",
    "dist:mac": "npm run build && electron-builder --mac",
    "dist:win": "npm run build && electron-builder --win"
  },
  "build": {
    "appId": "com.librarydesk.app",
    "productName": "Library Desk",
    "directories": {
      "output": "release",
      "buildResources": "build"
    },
    "files": [
      "out/**/*",
      "package.json"
    ],
    "asarUnpack": [
      "**/*.node"
    ],
    "mac": {
      "icon": "build/icon.png",
      "target": ["dmg"],
      "category": "public.app-category.productivity"
    },
    "win": {
      "icon": "build/icon.png",
      "target": ["nsis"]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

- [ ] **Step 3: `.gitignore` — `release/` ergänzen**

```
release
```

- [ ] **Step 4: README Dist-Abschnitt**

Kurz:

```markdown
## Build / Installer

- Mac: `npm run dist:mac` → `release/*.dmg`
- Windows: `npm run dist:win` → `release/*.exe`
```

- [ ] **Step 5: Spec-Status aktualisieren**

In `docs/superpowers/specs/2026-10-05-app-icon-packaging-design.md`: Status → Freigegeben / in Umsetzung.

---

### Task 3: Fenster-/Dock-Icon im Main-Process

**Files:**
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: packed `build/icon.png` (dev: relativ zu Projektroot; prod: aus resources)
- Produces: BrowserWindow mit `icon` Pfad

- [ ] **Step 1: Icon-Pfad Helper**

In `src/main/index.ts` vor `createWindow`:

```ts
import { existsSync } from 'fs'

function resolveAppIcon(): string | undefined {
  const candidates = [
    join(__dirname, '../../build/icon.png'),
    join(process.resourcesPath, 'build/icon.png'),
    join(process.resourcesPath, 'icon.png'),
  ]
  return candidates.find((p) => existsSync(p))
}
```

- [ ] **Step 2: BrowserWindow `icon` setzen**

```ts
const icon = resolveAppIcon()
const mainWindow = new BrowserWindow({
  width: 1100,
  height: 760,
  show: false,
  title: 'Library Desk',
  ...(icon ? { icon } : {}),
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
  },
})
```

Auf macOS optional Dock:

```ts
if (process.platform === 'darwin' && icon) {
  app.dock?.setIcon(icon)
}
```

(`setIcon` nur nach `app.whenReady`, also in `createWindow` oder direkt danach aufrufen.)

- [ ] **Step 3: Tests unverändert grün**

```bash
npm test
```

Expected: PASS

---

### Task 4: Dist-Builds ausführen

**Files:**
- Produce: `release/*.dmg`, ggf. `release/*.exe`

**Interfaces:**
- Consumes: Tasks 1–3

- [ ] **Step 1: Mac-Build**

```bash
npm run dist:mac
```

Expected: `release/` enthält `.dmg`; Exit 0. Bei `better-sqlite3`-Fehler:

```bash
npx @electron/rebuild -f -w better-sqlite3
npm run dist:mac
```

- [ ] **Step 2: Win-Build versuchen**

```bash
npm run dist:win
```

Expected: `.exe` in `release/` **oder** klarer Fehler (Cross-compile). Bei Failure: in README notieren, dass Win-Build auf Windows/CI laufen soll; Mac-DMG bleibt Deliverable.

- [ ] **Step 3: Kurz verifizieren**

- DMG öffnen / App starten (manuell)
- Icon im Dock/Fenster sichtbar

---

## Spec coverage (self-review)

| Spec | Task |
|---|---|
| Icon Liste+Noten, Blau→Weiß | 1 |
| build/icon.png Master | 1 |
| electron-builder, appId, productName | 2 |
| macOS dmg, Win nsis | 2, 4 |
| better-sqlite3 / asarUnpack | 2, 4 |
| Fenster-Icon | 3 |
| Kein Signing/Linux/Auto-Update | bewusst nicht in Tasks |

## Placeholder scan

Keine TBD/TODO-Schritte.
