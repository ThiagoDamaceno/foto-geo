import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { AppInfo, ScanResult } from '@shared/types'
import type { PhotoMetadata, Template } from '@shared/types'
import { openFolder, pickFolder, pickImages, pickLogo, pickOutputDir } from '../services/dialog.service'
import { cancelBatch, runBatch } from '../services/batch.service'
import { loadLogoAsset } from '../services/logo.service'
import { collectImagePaths } from '../services/files.service'
import { scanPhotos } from '../services/exif.service'
import { getPreviewImage, renderPreview } from '../services/render.service'
import {
  deleteProfile,
  duplicateProfile,
  listProfiles,
  loadProfile,
  saveProfile
} from '../services/profile.service'

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

  ipcMain.handle(IPC.pickImages, (event) => pickImages(windowOf(event)))
  ipcMain.handle(IPC.pickFolder, (event) => pickFolder(windowOf(event)))

  ipcMain.handle(IPC.scanPhotos, async (_event, paths: unknown): Promise<ScanResult> => {
    if (!Array.isArray(paths)) return { photos: [], ignored: [] }

    // caminhos vindos do Renderer são sempre validados aqui (ARQUITETURA.md §11)
    const { files, ignored } = await collectImagePaths(paths as string[])
    return { photos: await scanPhotos(files), ignored }
  })

  ipcMain.handle(IPC.previewImage, async (_event, filePath: string, maxWidth: number) => {
    await assertImportedFile(filePath)
    return getPreviewImage(filePath, clampWidth(maxWidth))
  })

  ipcMain.handle(
    IPC.renderPreview,
    async (_event, photo: PhotoMetadata, template: Template, maxWidth: number) => {
      await assertImportedFile(photo.filePath)
      return renderPreview(photo, template, clampWidth(maxWidth))
    }
  )

  ipcMain.handle(IPC.pickLogo, (event) => pickLogo(windowOf(event)))
  ipcMain.handle(IPC.readLogo, (_event, filePath: string) => loadLogoAsset(filePath))

  // Perfis (RF-07). O `id` é validado dentro do serviço — nada do Renderer virá caminho aqui.
  ipcMain.handle(IPC.profilesList, () => listProfiles())
  ipcMain.handle(IPC.profilesLoad, (_event, id: string) => loadProfile(id))
  ipcMain.handle(IPC.profilesSave, (_event, id: string | null, template: unknown) =>
    saveProfile(typeof id === 'string' ? id : null, template)
  )
  ipcMain.handle(IPC.profilesDuplicate, (_event, id: string) => duplicateProfile(id))
  ipcMain.handle(IPC.profilesDelete, (_event, id: string) => deleteProfile(id))

  // Lote (RF-09). O resumo volta neste mesmo `invoke`; o `batch:progress` é só a barra.
  ipcMain.handle(IPC.pickOutputDir, (event) => pickOutputDir(windowOf(event)))
  ipcMain.handle(IPC.batchStart, (event, config: unknown) =>
    runBatch(config, (progress) => {
      // a janela pode ter sido fechada no meio do lote
      if (!event.sender.isDestroyed()) event.sender.send(IPC.batchProgress, progress)
    })
  )
  ipcMain.handle(IPC.batchCancel, () => cancelBatch())
  ipcMain.handle(IPC.openPath, (_event, target: unknown) => openFolder(target))
}

/** Caminho vindo do Renderer passa pela mesma validação do import (ARQUITETURA.md §11). */
async function assertImportedFile(filePath: unknown): Promise<void> {
  const { files } = await collectImagePaths([filePath as string])
  if (files.length !== 1) throw new Error('Arquivo de imagem inválido')
}

function clampWidth(maxWidth: unknown): number {
  const value = typeof maxWidth === 'number' && Number.isFinite(maxWidth) ? maxWidth : 1280
  return Math.min(Math.max(Math.round(value), 320), 4096)
}

function windowOf(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}
