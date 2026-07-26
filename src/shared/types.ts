/**
 * Tipos compartilhados entre Main, Preload e Renderer.
 * Ver ARQUITETURA.md §4 — este arquivo cresce com Template/PhotoMetadata etc.
 */

/** Versões do runtime, exibidas na tela inicial (diagnóstico). */
export interface AppInfo {
  appName: string
  appVersion: string
  electron: string
  chrome: string
  node: string
  platform: NodeJS.Platform
  isPackaged: boolean
}

/** API exposta pelo preload em `window.fotoGeo` (ARQUITETURA.md §5). */
export interface FotoGeoApi {
  /** Sanity check do canal IPC: devolve `'pong'`. */
  ping: () => Promise<string>
  getAppInfo: () => Promise<AppInfo>
}
