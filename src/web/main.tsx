import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@renderer/App'
import '@renderer/styles.css'
import type { DeskApi } from '@shared/deskApi'
import { createWebDeskApi } from './deskApi'

declare global {
  interface Window {
    desk: DeskApi
  }
}

async function boot(): Promise<void> {
  window.desk = await createWebDeskApi()
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void boot().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  document.body.innerHTML = `<pre style="padding:24px;font:14px/1.4 system-ui">Library Desk Web konnte nicht starten:\n${message}</pre>`
})
