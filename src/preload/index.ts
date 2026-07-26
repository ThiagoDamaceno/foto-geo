import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '../shared/ipc-channels'
import type { AppInfo, FotoGeoApi } from '../shared/types'

/** Única superfície de contato do Renderer com o Node (ARQUITETURA.md §5/§11). */
const api: FotoGeoApi = {
  ping: () => ipcRenderer.invoke(IPC.ping),
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo) as Promise<AppInfo>
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('fotoGeo', api)
  } catch (error) {
    console.error('[preload] falha ao expor API:', error)
  }
} else {
  // @ts-expect-error — fallback sem contextIsolation (não usado em produção)
  window.electron = electronAPI
  // @ts-expect-error — idem
  window.fotoGeo = api
}
