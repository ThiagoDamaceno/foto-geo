import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '@shared/ipc-channels'
import type {
  AppInfo,
  FotoGeoApi,
  LogoAsset,
  PreviewImage,
  ProfileFile,
  ProfileSummary,
  RenderedPreview,
  ScanResult
} from '@shared/types'

/** Única superfície de contato do Renderer com o Node (ARQUITETURA.md §5/§11). */
const api: FotoGeoApi = {
  ping: () => ipcRenderer.invoke(IPC.ping),
  getAppInfo: () => ipcRenderer.invoke(IPC.appInfo) as Promise<AppInfo>,
  pickImages: () => ipcRenderer.invoke(IPC.pickImages) as Promise<string[]>,
  pickFolder: () => ipcRenderer.invoke(IPC.pickFolder) as Promise<string[]>,
  scanPhotos: (paths) => ipcRenderer.invoke(IPC.scanPhotos, paths) as Promise<ScanResult>,
  getPreviewImage: (filePath, maxWidth) =>
    ipcRenderer.invoke(IPC.previewImage, filePath, maxWidth) as Promise<PreviewImage>,
  renderPreview: (photo, template, maxWidth) =>
    ipcRenderer.invoke(IPC.renderPreview, photo, template, maxWidth) as Promise<RenderedPreview>,
  pickLogo: () => ipcRenderer.invoke(IPC.pickLogo) as Promise<LogoAsset | null>,
  readLogo: (filePath) => ipcRenderer.invoke(IPC.readLogo, filePath) as Promise<LogoAsset>,
  listProfiles: () => ipcRenderer.invoke(IPC.profilesList) as Promise<ProfileSummary[]>,
  loadProfile: (id) => ipcRenderer.invoke(IPC.profilesLoad, id) as Promise<ProfileFile>,
  saveProfile: (id, template) =>
    ipcRenderer.invoke(IPC.profilesSave, id, template) as Promise<ProfileSummary>,
  duplicateProfile: (id) =>
    ipcRenderer.invoke(IPC.profilesDuplicate, id) as Promise<ProfileSummary>,
  deleteProfile: (id) => ipcRenderer.invoke(IPC.profilesDelete, id) as Promise<void>
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
