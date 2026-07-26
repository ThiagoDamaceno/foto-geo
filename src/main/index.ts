import { join } from 'node:path'
import { app, shell, BrowserWindow, Menu, nativeTheme } from 'electron'
import { electronApp, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc/handlers'
import { disposeExifTool } from './services/exif.service'
import { applyContentSecurityPolicy } from './security'
import { hardenWindowShortcuts, DEVTOOLS_ENABLED } from './shortcuts'

// No WSL/WSLg o Chromium não consegue inicializar a GPU e cai para renderização por
// software depois de vários erros no log. O alvo do produto é Windows, então só no
// Linux (ambiente de dev) já subimos sem aceleração — menos ruído, mesmo resultado.
if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    // Cor inicial só para não piscar branco/preto antes do primeiro paint; o tema
    // efetivo é decidido no Renderer (RNF-09, `renderer/src/lib/theme.ts`).
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#020617' : '#f1f5f9',
    title: 'Foto Geo',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // ARQUITETURA.md §11 — Renderer sem acesso a Node; tudo via IPC nomeado.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Console/DevTools desligados (RNF-10). Para depurar: FOTOGEO_DEVTOOLS=1 yarn dev
      devTools: DEVTOOLS_ENABLED
    }
  })

  hardenWindowShortcuts(window)

  window.on('ready-to-show', () => window.show())

  // App offline: nenhuma navegação/janela externa.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('file://')) return { action: 'allow' }
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

// Uma instância só (evita dois processos disputando o mesmo lote/perfis).
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [existing] = BrowserWindow.getAllWindows()
    if (existing) {
      if (existing.isMinimized()) existing.restore()
      existing.focus()
    }
  })

  void app.whenReady().then(() => {
    electronApp.setAppUserModelId('br.com.brtk.fotogeo')
    // Sem menu nativo: tira também o "View → Toggle Developer Tools" (RNF-10).
    Menu.setApplicationMenu(null)
    applyContentSecurityPolicy()
    registerIpcHandlers()

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  // O exiftool roda em processos filhos — sem isso eles ficariam órfãos.
  app.on('will-quit', (event) => {
    event.preventDefault()
    void disposeExifTool().finally(() => app.exit(0))
  })
}
