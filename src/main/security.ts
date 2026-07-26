import { session } from 'electron'
import { is } from '@electron-toolkit/utils'

/**
 * CSP do Renderer (ARQUITETURA.md §11).
 * Em produção a rede fica bloqueada (`connect-src 'none'`) — o app é 100% offline.
 * Em dev liberamos o dev server/HMR do Vite (localhost + websocket).
 */
const CSP_PROD = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: file:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ')

const CSP_DEV = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: file:",
  "font-src 'self' data:",
  "connect-src 'self' ws: http://localhost:* http://127.0.0.1:*",
  "object-src 'none'"
].join('; ')

export function applyContentSecurityPolicy(): void {
  const csp = is.dev ? CSP_DEV : CSP_PROD

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })
}
