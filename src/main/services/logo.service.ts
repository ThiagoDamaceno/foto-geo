import { stat } from 'node:fs/promises'
import { extname } from 'node:path'
import sharp from 'sharp'
import { isSupportedLogo, LOGO_EXTENSIONS } from '@shared/image-formats'
import type { LogoAsset } from '@shared/types'
import { resolveLogoPath } from './app-paths'

/**
 * Logo do carimbo (RF-06).
 *
 * Tudo é convertido para **PNG** aqui (PNG/JPEG/WebP/BMP/TIFF/SVG…): o preview (Chromium)
 * e a saída (librsvg/Sharp) rasterizam SVG aninhado de formas diferentes, então entregar o
 * mesmo PNG aos dois lados é o que mantém preview = arquivo (RNF-05).
 */

export { LOGO_EXTENSIONS }

/** Largura máxima do PNG gerado — a logo ocupa ~15% de uma foto de 8064 px. */
const MAX_LOGO_WIDTH = 1600

interface CacheEntry extends LogoAsset {
  mtimeMs: number
}

const cache = new Map<string, CacheEntry>()

export async function loadLogoAsset(rawPath: string): Promise<LogoAsset> {
  const filePath = resolveLogoPath(rawPath)
  if (!isSupportedLogo(filePath)) {
    throw new Error('Formato de logo não suportado (use PNG, SVG, WebP, JPEG…)')
  }

  const { mtimeMs } = await stat(filePath)
  const cached = cache.get(filePath)
  if (cached && cached.mtimeMs === mtimeMs) return withoutMtime(cached)

  // SVG rasteriza pela densidade; 600 dpi dá borda limpa mesmo em logo pequena
  const input = extname(filePath).toLowerCase() === '.svg' ? { density: 600 } : {}
  const { data, info } = await sharp(filePath, input)
    .resize({ width: MAX_LOGO_WIDTH, withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true })

  const asset: CacheEntry = {
    filePath,
    dataUrl: `data:image/png;base64,${data.toString('base64')}`,
    aspectRatio: info.height === 0 ? 1 : info.width / info.height,
    mtimeMs
  }

  cache.set(filePath, asset)
  return withoutMtime(asset)
}

function withoutMtime({ filePath, dataUrl, aspectRatio }: CacheEntry): LogoAsset {
  return { filePath, dataUrl, aspectRatio }
}
