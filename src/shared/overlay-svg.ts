/**
 * Gera o SVG do carimbo (seção + ícones + logo) — ARQUITETURA.md §9/§10.
 *
 * **Um gerador só para os dois lados:** o Main entrega este SVG ao Sharp para compor a foto
 * final, e o Renderer exibe o MESMO SVG sobre a foto no editor. Não existe "layout do preview"
 * separado do "layout da saída", o que elimina a maior fonte de divergência (RNF-05/§13).
 */
import { sectionMetrics, logoBox, type Box, type Size } from './geometry'
import { FIELD_LABEL } from './field-icons'
import { formatFieldValue } from './format'
import type { FieldKey, PhotoMetadata, Template } from './types'

export interface OverlayInput {
  /** Tamanho em px da imagem alvo (real no render final, reduzido no preview). */
  size: Size
  template: Template
  photo: PhotoMetadata
  /** Markup interno do ícone Lucide (viewBox 24×24) por campo. */
  icons: Partial<Record<FieldKey, string>>
  /** `data:font/ttf;base64,…` da Roboto embarcada, quando disponível (§9.1). */
  fontDataUrl?: string
  /** Logo já convertida em data URI (PNG/SVG). */
  logoDataUrl?: string
  /** largura/altura da logo — define a altura da caixa. */
  logoAspectRatio?: number
}

export interface Overlay {
  svg: string
  /** Caixa da seção em px, para o editor desenhar as alças em cima. */
  sectionBox: Box
  /** Campos que entraram no carimbo desta foto (os sem valor são omitidos). */
  rows: FieldKey[]
}

export function buildOverlaySvg(input: OverlayInput): Overlay {
  const { size, template, photo, icons } = input
  const { section } = template

  const rows = section.fields
    .filter((field) => field.visible)
    .map((field) => ({ field, value: formatFieldValue(field.key, photo) }))
    .filter((row): row is { field: (typeof section.fields)[number]; value: string } =>
      Boolean(row.value)
    )

  const metrics = sectionMetrics(section, size, rows.length)
  const parts: string[] = []

  if (rows.length > 0) {
    parts.push(
      `<rect x="${round(metrics.x)}" y="${round(metrics.y)}" width="${round(metrics.width)}" height="${round(metrics.height)}" rx="${round(metrics.radius)}" fill="${section.bgColor}" fill-opacity="${section.bgOpacity}"/>`
    )
  }

  rows.forEach(({ field, value }, index) => {
    const rowTop = metrics.contentY + index * (metrics.lineHeight + metrics.lineGap)
    const baseline = rowTop + metrics.lineHeight / 2 + metrics.fontSize * 0.35
    const iconMarkup = field.showIcon ? icons[field.key] : undefined

    if (iconMarkup) {
      const scale = metrics.iconSize / 24
      const iconTop = rowTop + (metrics.lineHeight - metrics.iconSize) / 2
      parts.push(
        `<g transform="translate(${round(metrics.contentX)} ${round(iconTop)}) scale(${round(scale, 4)})" fill="none" stroke="${section.textColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconMarkup}</g>`
      )
    }

    const textX = metrics.contentX + (iconMarkup ? metrics.iconSize + metrics.iconGap : 0)
    const text = field.showLabel ? `${FIELD_LABEL[field.key]}: ${value}` : value

    parts.push(
      `<text x="${round(textX)}" y="${round(baseline)}" font-family="${fontStack(section.fontFamily)}" font-size="${round(metrics.fontSize)}" fill="${section.textColor}" xml:space="preserve">${escapeXml(text)}</text>`
    )
  })

  if (input.logoDataUrl) {
    const box = logoBox(template.logo, size, input.logoAspectRatio ?? 1)
    parts.push(
      `<image x="${round(box.x)}" y="${round(box.y)}" width="${round(box.width)}" height="${round(box.height)}" opacity="${template.logo.opacity}" href="${escapeXml(input.logoDataUrl)}" preserveAspectRatio="xMidYMid meet"/>`
    )
  }

  const defs = input.fontDataUrl
    ? `<defs><style>@font-face{font-family:'${section.fontFamily}';src:url('${input.fontDataUrl}') format('truetype');}</style></defs>`
    : ''

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${round(size.width)}" height="${round(size.height)}" ` +
    `viewBox="0 0 ${round(size.width)} ${round(size.height)}">${defs}${parts.join('')}</svg>`

  return {
    svg,
    sectionBox: { x: metrics.x, y: metrics.y, width: metrics.width, height: metrics.height },
    rows: rows.map((row) => row.field.key)
  }
}

/**
 * Tira o invólucro `<svg …>` de um ícone Lucide e devolve só o conteúdo.
 * Os dois processos leem os MESMOS arquivos do `lucide-static` e passam por aqui — é o que
 * garante ícone idêntico no preview e na saída (§9).
 */
export function extractIconMarkup(svgSource: string): string {
  const inner = /<svg[^>]*>([\s\S]*?)<\/svg>/i.exec(svgSource)?.[1] ?? ''
  return inner.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim()
}

function fontStack(fontFamily: string): string {
  return escapeXml(`'${fontFamily}', sans-serif`)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** SVG → data URI utilizável em `<img src>` (sem base64: mantém legível e evita unicode). */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
