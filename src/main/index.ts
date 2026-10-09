import { existsSync } from 'fs'
import { app, BrowserWindow, dialog, protocol } from 'electron'
import { join } from 'path'
import { installAppMenu } from './appMenu'
import { registerDeskAudioProtocol } from './audioProtocol'
import { openDatabase, type AppDatabase } from './db'
import { registerIpc } from './ipc'

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
    app.quit()
    return
  }
  registerIpc(db, userData)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  db?.close()
  db = null
})
