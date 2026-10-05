import { app, BrowserWindow, protocol } from 'electron'
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

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    show: false,
    title: 'Library Desk',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

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
  db = openDatabase(join(userData, 'library.db'))
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
