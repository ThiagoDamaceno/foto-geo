import sharp from 'sharp'
import { buildOverlaySvg } from '@shared/overlay-svg'
import type { Size } from '@shared/geometry'
import type { PhotoMetadata, PreviewImage, RenderedPreview, Template } from '@shared/types'
import { loadRobotoDataUrl } from './font.service'
import { ICON_MARKUP } from './icon-markup'
import { loadLogoAsset } from './logo.service'
import { rasterizeOverlaySvg } from './overlay-raster'

/**
 * Render do carimbo (ARQUITETURA.md §10): SVG compartilhado → PNG (resvg + Roboto) →
 * Sharp compõe sobre a foto. O original nunca é tocado (RF-10).
 */

// No Linux o libvips do sharp divide com a GLib do Electron; várias threads + fotos 36 MP
// levam a SIGTRAP. No Windows o default do sharp segue normalmente.
if (process.platform !== 'win32') {
  sharp.concurrency(1)
  sharp.cache(false)
}

const PREVIEW_QUALITY = 82

/**
 * Saída do lote: prioriza fidelidade à original (menos perda), não o menor arquivo.
 * `4:4:4` evita subsample de cor; 98 fica perto do JPEG da câmera (recompressão
 * sempre reduz um pouco o tamanho — 23 MB → ~18–22 MB é o esperado, não 10 MB).
 */
const OUTPUT_JPEG = {
  quality: 98,
  chromaSubsampling: '4:4:4' as const
}

/** Foto reduzida para o fundo do editor. */
export async function getPreviewImage(filePath: string, maxWidth: number): Promise<PreviewImage> {
  const source = await effectiveSize(filePath)
  const { data, info } = await sharp(filePath)
    .rotate()
    .resize({ width: Math.min(maxWidth, source.width), withoutEnlargement: true })
    .jpeg({ quality: PREVIEW_QUALITY })
    .toBuffer({ resolveWithObject: true })

  return {
    dataUrl: toDataUrl(data),
    width: info.width,
    height: info.height,
    sourceWidth: source.width,
    sourceHeight: source.height
  }
}

/**
 * Carimba em **tamanho real** e devolve reduzido só para exibir — é a conferência
 * pixel-a-pixel do preview (RNF-05) e a primeira medida de tempo por foto (RNF-06).
 */
export async function renderPreview(
  photo: PhotoMetadata,
  template: Template,
  maxWidth: number
): Promise<RenderedPreview> {
  const source = await effectiveSize(photo.filePath)
  const svg = await buildSvg(photo, template, source)
  const started = process.hrtime.bigint()

  // Overlay vira PNG via resvg (fonte confiável no Windows); Sharp só compõe/redimensiona.
  const overlay = rasterizeOverlaySvg(svg, source)
  const composed = await sharp(photo.filePath)
    .rotate()
    .composite([{ input: overlay, top: 0, left: 0 }])
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { data, info } = await sharp(composed.data, {
    raw: {
      width: composed.info.width,
      height: composed.info.height,
      channels: composed.info.channels
    }
  })
    .resize({ width: Math.min(maxWidth, source.width), withoutEnlargement: true })
    .jpeg({ quality: PREVIEW_QUALITY })
    .toBuffer({ resolveWithObject: true })

  return {
    dataUrl: toDataUrl(data),
    width: info.width,
    height: info.height,
    sourceWidth: source.width,
    sourceHeight: source.height,
    elapsedMs: Number(process.hrtime.bigint() - started) / 1e6
  }
}

/** Gera a cópia carimbada em tamanho real. Usado pelo lote (passo 7). */
export async function renderPhotoToFile(
  photo: PhotoMetadata,
  template: Template,
  outputPath: string
): Promise<void> {
  const source = await effectiveSize(photo.filePath)
  const svg = await buildSvg(photo, template, source)

  const overlay = rasterizeOverlaySvg(svg, source)

  await sharp(photo.filePath)
    .rotate()
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg(OUTPUT_JPEG)
    .keepMetadata()
    .toFile(outputPath)
}

async function buildSvg(photo: PhotoMetadata, template: Template, size: Size): Promise<string> {
  const fontDataUrl = await loadRobotoDataUrl()
  const logos = await loadLogos(template)

  return buildOverlaySvg({
    size,
    template,
    // o carimbo é desenhado sobre a imagem já rotacionada
    photo: { ...photo, width: size.width, height: size.height },
    icons: ICON_MARKUP,
    ...(fontDataUrl ? { fontDataUrl } : {}),
    logos
  }).svg
}

/** Logo faltando/ilegível não invalida o carimbo — só sai sem ela (RNF-08). */
async function loadLogos(
  template: Template
): Promise<Array<{ id: string; dataUrl: string; aspectRatio: number }>> {
  const loaded: Array<{ id: string; dataUrl: string; aspectRatio: number }> = []

  for (const logo of template.logos) {
    try {
      const asset = await loadLogoAsset(logo.filePath)
      loaded.push({ id: logo.id, dataUrl: asset.dataUrl, aspectRatio: asset.aspectRatio })
    } catch {
      // ignora arquivo ausente no render — o lote/editor já avisam no carregamento do perfil
    }
  }

  return loaded
}

/**
 * Dimensões **após** aplicar a orientação EXIF (o `.rotate()` do Sharp).
 * Orientações 5–8 giram 90°, então largura e altura trocam.
 */
async function effectiveSize(filePath: string): Promise<Size> {
  const { width = 0, height = 0, orientation } = await sharp(filePath).metadata()
  const swap = (orientation ?? 1) >= 5
  return { width: swap ? height : width, height: swap ? width : height }
}

function toDataUrl(data: Buffer): string {
  return `data:image/jpeg;base64,${data.toString('base64')}`
}
