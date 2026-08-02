import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '@shared/ipc-channels'
import type {
  AppInfo,
  FotoGeoApi,
  JobProgress,
  JobResult,
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
  pickLogo: () => ipcRenderer.invoke(IPC.pickLogo) as Promise<LogoAsset[]>,
  readLogo: (filePath) => ipcRenderer.invoke(IPC.readLogo, filePath) as Promise<LogoAsset>,
  listProfiles: () => ipcRenderer.invoke(IPC.profilesList) as Promise<ProfileSummary[]>,
  loadProfile: (id) => ipcRenderer.invoke(IPC.profilesLoad, id) as Promise<ProfileFile>,
  saveProfile: (id, template) =>
    ipcRenderer.invoke(IPC.profilesSave, id, template) as Promise<ProfileSummary>,
  duplicateProfile: (id) =>
    ipcRenderer.invoke(IPC.profilesDuplicate, id) as Promise<ProfileSummary>,
  deleteProfile: (id) => ipcRenderer.invoke(IPC.profilesDelete, id) as Promise<void>,
  pickOutputDir: () => ipcRenderer.invoke(IPC.pickOutputDir) as Promise<string | null>,
  startBatch: (config) => ipcRenderer.invoke(IPC.batchStart, config) as Promise<JobResult>,
  cancelBatch: () => ipcRenderer.invoke(IPC.batchCancel) as Promise<void>,
  openPath: (target) => ipcRenderer.invoke(IPC.openPath, target) as Promise<void>,
  onBatchProgress: (listener) => {
    const handler = (_event: IpcRendererEvent, progress: JobProgress): void => listener(progress)
    ipcRenderer.on(IPC.batchProgress, handler)
    // devolver o "desassinar" evita listener duplicado quando o React remonta o efeito
    return () => {
      ipcRenderer.removeListener(IPC.batchProgress, handler)
    }
  },
  getOverlayFont: () => ipcRenderer.invoke(IPC.overlayFont) as Promise<string | undefined>
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
