import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveFontsDirSync, setupFontsBeforeSharp } from './font-env'

/**
 * Roboto embarcada (ARQUITETURA.md §9.1).
 * Env/fontconfig: `font-env.ts` (antes do Sharp). Aqui só a data URL pro Chromium.
 */

let fontDataUrlCache: string | null | undefined

/** Garante conf/env (idempotente se o bootstrap já rodou). */
export function ensureFontconfig(): void {
  setupFontsBeforeSharp()
}

/** `data:font/ttf;base64,…` para o SVG do editor (Chromium). */
export async function loadRobotoDataUrl(): Promise<string | undefined> {
  if (fontDataUrlCache !== undefined) return fontDataUrlCache ?? undefined

  try {
    ensureFontconfig()
    const file = await readFile(join(resolveFontsDirSync(), 'roboto.ttf'))
    fontDataUrlCache = `data:font/ttf;base64,${file.toString('base64')}`
  } catch {
    fontDataUrlCache = null
  }

  return fontDataUrlCache ?? undefined
}
