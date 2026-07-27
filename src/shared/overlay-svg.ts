/**
 * Gera o SVG do carimbo (seção + ícones + logo) — ARQUITETURA.md §9/§10.
 *
 * **Um gerador só para os dois lados:** o Main entrega este SVG ao Sharp para compor a foto
 * final, e o Renderer exibe o MESMO SVG sobre a foto no editor. Não existe "layout do preview"
 * separado do "layout da saída", o que elimina a maior fonte de divergência (RNF-05/§13).
 */
import { sectionMetrics, logoBox, type Box, type SectionRowKind, type Size } from './geometry'
import { FIELD_LABEL } from './field-icons'
import { formatFieldValue } from './format'
import { isDivider } from './types'
import type { FieldConfig, FieldKey, PhotoMetadata, Template } from './types'

export interface OverlayInput {
  /** Tamanho em px da imagem alvo (real no render final, reduzido no preview). */
  size: Size
  template: Template
  photo: PhotoMetadata
  /** Markup interno do ícone Lucide (viewBox 24×24) por campo. */
  icons: Partial<Record<FieldKey, string>>
  /** `data:font/ttf;base64,…` da Roboto embarcada, quando disponível (§9.1). */
  fontDataUrl?: string
  /** Logo já convertida em data URI PNG (origem pode ser SVG/WebP/etc.). */
  logoDataUrl?: string
  /** largura/altura da logo — define a altura da caixa. */
  logoAspectRatio?: number
}

export interface Overlay {
  svg: string
  /** Caixa da seção em px, para o editor desenhar as alças em cima. */
  sectionBox: Box
  /** Campos (com valor) e divisores que entraram no carimbo desta foto. */
  rows: Array<FieldKey | 'divider'>
}

type ContentRow =
  | { kind: 'field'; field: FieldConfig; value: string }
  | { kind: 'divider' }

export function buildOverlaySvg(input: OverlayInput): Overlay {
  const { size, template, photo, icons } = input
  const { section } = template

  const rows: ContentRow[] = []
  for (const item of section.fields) {
    if (!item.visible) continue
    if (isDivider(item)) {
      rows.push({ kind: 'divider' })
      continue
    }
    const value = formatFieldValue(item.key, photo)
    if (value) rows.push({ kind: 'field', field: item, value })
  }

  const kinds: SectionRowKind[] = rows.map((row) => row.kind)
  const metrics = sectionMetrics(section, size, kinds)
  const parts: string[] = []

  // mesma espessura do divisor (e da borda do card, quando ligada)
  const lineStroke = Math.max(metrics.fontSize * 0.08, 1)

  if (rows.length > 0) {
    const border =
      section.showBorder
        ? ` stroke="${section.textColor}" stroke-opacity="0.55" stroke-width="${round(lineStroke)}"`
        : ''
    parts.push(
      `<rect x="${round(metrics.x)}" y="${round(metrics.y)}" width="${round(metrics.width)}" height="${round(metrics.height)}" rx="${round(metrics.radius)}" fill="${section.bgColor}" fill-opacity="${section.bgOpacity}"${border}/>`
    )
  }

  let rowTop = metrics.contentY
  const contentWidth = metrics.width - metrics.padding * 2

  rows.forEach((row, index) => {
    const rowHeight = metrics.rowHeights[index] ?? metrics.lineHeight

    if (row.kind === 'divider') {
      // linha a 100% da largura útil (entre paddings), centrada na faixa do divisor
      const y = rowTop + rowHeight / 2
      parts.push(
        `<line x1="${round(metrics.contentX)}" y1="${round(y)}" x2="${round(metrics.contentX + contentWidth)}" y2="${round(y)}" stroke="${section.textColor}" stroke-opacity="0.55" stroke-width="${round(lineStroke)}"/>`
      )
    } else {
      const { field, value } = row
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
    }

    rowTop += rowHeight + metrics.lineGap
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
    rows: rows.map((row) => (row.kind === 'divider' ? 'divider' : row.field.key))
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
