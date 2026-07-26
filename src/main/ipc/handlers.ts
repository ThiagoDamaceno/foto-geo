import { app, ipcMain } from 'electron'
import { IPC } from '../../shared/ipc-channels'
import type { AppInfo } from '../../shared/types'

/** Registra os handlers IPC do Main (ARQUITETURA.md §5). */
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.ping, (): string => 'pong')

  ipcMain.handle(IPC.appInfo, (): AppInfo => {
    return {
      appName: app.getName(),
      appVersion: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      node: process.versions.node,
      platform: process.platform,
      isPackaged: app.isPackaged
    }
  })
}
