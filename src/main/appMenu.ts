import { Menu, app, type BrowserWindow } from 'electron'

function send(win: BrowserWindow | undefined, channel: string): void {
  win?.webContents.send(channel)
}

export function installAppMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            role: 'appMenu' as const,
          },
        ]
      : []),
    {
      label: 'Bearbeiten',
      submenu: [
        {
          label: 'Widerrufen',
          accelerator: 'CmdOrCtrl+Z',
          click: (_item, focusedWindow) => {
            send(focusedWindow ?? undefined, 'edit:undo')
          },
        },
        {
          label: 'Wiederholen',
          accelerator: isMac ? 'Shift+CmdOrCtrl+Z' : 'Ctrl+Y',
          click: (_item, focusedWindow) => {
            send(focusedWindow ?? undefined, 'edit:redo')
          },
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]

  if (!isMac) {
    template.unshift({
      label: app.name,
      submenu: [{ role: 'quit' }],
    })
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
