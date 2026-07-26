import type { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'

/**
 * DevTools/console ficam desligados (RNF-10) — o app é uma ferramenta de campo, não
 * queremos o usuário abrindo o console por acidente. Escape hatch para depurar:
 * `FOTOGEO_DEVTOOLS=1 yarn dev`.
 */
export const DEVTOOLS_ENABLED = process.env['FOTOGEO_DEVTOOLS'] === '1'

const DEVTOOLS_KEYS = ['KeyI', 'KeyJ', 'KeyC']
const ZOOM_KEYS = ['Minus', 'Equal', 'Digit0', 'NumpadAdd', 'NumpadSubtract']

/** Bloqueia os atalhos de teclado que não fazem sentido no app. */
export function hardenWindowShortcuts(window: BrowserWindow): void {
  const { webContents } = window

  webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    const mod = input.control || input.meta

    // F12 / Ctrl+Shift+I|J|C / Cmd+Alt+I → DevTools.
    const isDevTools =
      input.code === 'F12' ||
      (mod && input.shift && DEVTOOLS_KEYS.includes(input.code)) ||
      (input.meta && input.alt && DEVTOOLS_KEYS.includes(input.code))
    if (isDevTools && !DEVTOOLS_ENABLED) {
      event.preventDefault()
      return
    }

    // Ctrl+R / F5 recarregariam o app e jogariam fora o template em edição
    // (em dev o HMR do Vite continua funcionando normalmente).
    const isReload = (mod && input.code === 'KeyR') || input.code === 'F5'
    if (isReload && !is.dev) {
      event.preventDefault()
      return
    }

    // Zoom por teclado desalinharia o preview WYSIWYG.
    if (mod && ZOOM_KEYS.includes(input.code)) event.preventDefault()
  })

  // Se algo mais tentar abrir o DevTools, fecha na hora.
  if (!DEVTOOLS_ENABLED) {
    webContents.on('devtools-opened', () => webContents.closeDevTools())
  }
}
