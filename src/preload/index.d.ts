import type { ElectronAPI } from '@electron-toolkit/preload'
import type { FotoGeoApi } from '@shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    fotoGeo: FotoGeoApi
  }
}
