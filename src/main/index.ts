import { existsSync } from 'fs'
import { app, BrowserWindow, dialog, protocol } from 'electron'
import { join } from 'path'
import { installAppMenu } from './appMenu'
import {
  broadcastAutoBackupNotice,
  defaultAutoBackupFolder,
  runAutoBackup,
  settingsFilePath,
  startAutoBackupScheduler,
  stopAutoBackupScheduler,
} from './autoBackupService'
import { registerDeskAudioProtocol } from './audioProtocol'
import { attachmentsRootFor } from './attachmentFs'
import { coverRootFor } from './coverFs'
import { openDatabase, type AppDatabase } from './db'
import { registerIpc } from './ipc'

/** true = Quit-Dialog überspringen (z. B. DB-Fehler beim Start) */
let skipQuitBackupPrompt = false
/** true = Beenden bereits bestätigt, erneutes before-quit durchlassen */
let quitConfirmed = false
let quitPromptInFlight = false

// file:// audio is blocked by webSecurity when the renderer is served over http.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'desk',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

function resolveAppIcon(): string | undefined {
  const candidates = [
    join(__dirname, '../../build/icon.png'),
    join(process.resourcesPath, 'build/icon.png'),
    join(process.resourcesPath, 'icon.png'),
  ]
  return candidates.find((p) => existsSync(p))
}

function createWindow(): void {
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

  // Packaged Mac apps use the bundle .icns (system squircle mask).
  // setIcon(PNG) draws a full square and looks oversized in the Dock.
  if (process.platform === 'darwin' && icon && !app.isPackaged) {
    app.dock?.setIcon(icon)
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

let db: AppDatabase | null = null

app.whenReady().then(() => {
  const userData = app.getPath('userData')
  installAppMenu()
  registerDeskAudioProtocol(userData)
  try {
    db = openDatabase(join(userData, 'library.db'))
  } catch (cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause)
    dialog.showErrorBox('Library Desk', `Datenbank konnte nicht geöffnet werden:\n${message}`)
    skipQuitBackupPrompt = true
    app.quit()
    return
  }
  registerIpc(db, userData)
  startAutoBackupScheduler({
    db,
    userData,
    audioRoot: join(userData, 'audio'),
    coverRoot: coverRootFor(userData),
    attachmentsRoot: attachmentsRootFor(userData),
    settingsPath: settingsFilePath(userData),
    defaultFolderPath: defaultAutoBackupFolder(),
    notify: broadcastAutoBackupNotice,
  })
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (skipQuitBackupPrompt || quitConfirmed) return
  if (quitPromptInFlight) {
    event.preventDefault()
    return
  }
  event.preventDefault()
  quitPromptInFlight = true
  void (async () => {
    try {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const ask = {
        type: 'question' as const,
        buttons: ['Mit Backup beenden', 'Ohne Backup beenden', 'Abbrechen'],
        defaultId: 0,
        cancelId: 2,
        title: 'Library Desk beenden',
        message: 'App beenden?',
        detail:
          'Soll vorher ein Backup der Bibliothek (.spd.zip) im Backup-Ordner angelegt werden?',
      }
      const choice = win
        ? await dialog.showMessageBox(win, ask)
        : await dialog.showMessageBox(ask)
      if (choice.response === 2) return
      if (choice.response === 0) {
        const result = await runAutoBackup()
        if (!result.ok) {
          const warn = {
            type: 'warning' as const,
            buttons: ['Trotzdem beenden', 'Abbrechen'],
            defaultId: 0,
            cancelId: 1,
            title: 'Backup fehlgeschlagen',
            message: 'Backup konnte nicht erstellt werden.',
            detail: result.error ?? 'Unbekannter Fehler',
          }
          const retry = win
            ? await dialog.showMessageBox(win, warn)
            : await dialog.showMessageBox(warn)
          if (retry.response === 1) return
        }
      }
      quitConfirmed = true
      app.quit()
    } finally {
      quitPromptInFlight = false
    }
  })()
})

app.on('will-quit', () => {
  stopAutoBackupScheduler()
  db?.close()
  db = null
})
