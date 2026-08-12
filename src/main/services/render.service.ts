import { stat } from 'node:fs/promises'
import sharp, { type Sharp } from 'sharp'
import { buildOverlaySvg } from '@shared/overlay-svg'
import { clampQuality, jpegOptions } from '@shared/output-quality'
import type { Size } from '@shared/geometry'
import type {
  OutputSizeEstimate,
  PhotoMetadata,
  PreviewImage,
  RenderedPreview,
  Template
} from '@shared/types'
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
 * Fila dos renders interativos (preview e estimativa de tamanho): **um por vez**.
 * Arrastar o slider de compressão dispara medidas em sequência; sem a fila, duas
 * composições de 36 MP disputariam ~300 MB — e no Linux (dev) sharp+Electron em paralelo
 * derruba o processo (ARQUITETURA.md §13).
 */
let interactiveQueue: Promise<unknown> = Promise.resolve()

function queueInteractive<T>(task: () => Promise<T>): Promise<T> {
  const result = interactiveQueue.then(task, task)
  // a fila nunca quebra: um render com erro não pode travar os próximos
  interactiveQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
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
 *
 * O que aparece na tela é o **arquivo de saída decodificado**, não o composite cru: assim
 * a perda da qualidade escolhida (RF-11) está no que se vê, e o tamanho em bytes é o real.
 */
export async function renderPreview(
  photo: PhotoMetadata,
  template: Template,
  maxWidth: number,
  quality: number
): Promise<RenderedPreview> {
  return queueInteractive(async () => {
    const source = await effectiveSize(photo.filePath)
    const started = process.hrtime.bigint()
    const output = await renderOutputBuffer(photo, template, source, quality)

    const { data, info } = await sharp(output)
      .resize({ width: Math.min(maxWidth, source.width), withoutEnlargement: true })
      .jpeg({ quality: PREVIEW_QUALITY })
      .toBuffer({ resolveWithObject: true })

    return {
      dataUrl: toDataUrl(data),
      width: info.width,
      height: info.height,
      sourceWidth: source.width,
      sourceHeight: source.height,
      elapsedMs: Number(process.hrtime.bigint() - started) / 1e6,
      outputBytes: output.byteLength
    }
  })
}

/**
 * Quanto esta foto vai pesar na qualidade escolhida (RF-11).
 *
 * Roda o pipeline **inteiro** do lote (carimbo incluído) em memória — o número é o do
 * arquivo, não uma regra de três sobre a resolução, que erraria feio em JPEG.
 */
export async function estimateOutputSize(
  photo: PhotoMetadata,
  template: Template,
  quality: number
): Promise<OutputSizeEstimate> {
  return queueInteractive(async () => {
    const started = process.hrtime.bigint()
    const source = await effectiveSize(photo.filePath)
    const output = await renderOutputBuffer(photo, template, source, quality)
    const { size: originalBytes } = await stat(photo.filePath)

    return {
      filePath: photo.filePath,
      quality: clampQuality(quality),
      originalBytes,
      outputBytes: output.byteLength,
      elapsedMs: Number(process.hrtime.bigint() - started) / 1e6
    }
  })
}

/** Gera a cópia carimbada em tamanho real. Usado pelo lote (passo 7). */
export async function renderPhotoToFile(
  photo: PhotoMetadata,
  template: Template,
  outputPath: string,
  quality: number
): Promise<void> {
  const source = await effectiveSize(photo.filePath)
  await (await outputPipeline(photo, template, source, quality)).toFile(outputPath)
}

/** A cópia carimbada em memória — mesmos bytes que `renderPhotoToFile` gravaria. */
async function renderOutputBuffer(
  photo: PhotoMetadata,
  template: Template,
  size: Size,
  quality: number
): Promise<Buffer> {
  return (await outputPipeline(photo, template, size, quality)).toBuffer()
}

/**
 * Pipeline único da saída — arquivo, preview e estimativa saem daqui, então não há como
 * o número da tela discordar do que o lote grava.
 *
 * Overlay vira PNG via resvg (fonte confiável no Windows); o Sharp só compõe e codifica.
 * `keepMetadata()` mantém EXIF/GPS na cópia — e entra na conta do tamanho.
 */
async function outputPipeline(
  photo: PhotoMetadata,
  template: Template,
  size: Size,
  quality: number
): Promise<Sharp> {
  const svg = await buildSvg(photo, template, size)
  const overlay = rasterizeOverlaySvg(svg, size)

  return sharp(photo.filePath)
    .rotate()
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg(jpegOptions(quality))
    .keepMetadata()
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
