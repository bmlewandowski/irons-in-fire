/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PERSISTENCE_ADAPTER: string
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
