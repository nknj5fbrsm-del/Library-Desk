/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DESK_WEB?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
