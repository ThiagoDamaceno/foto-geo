/**
 * Conversão relativo ⇄ px (ARQUITETURA.md §7) — o coração da fidelidade.
 *
 * Regra: posições são frações da largura/altura da imagem; **todos os tamanhos** são frações
 * da LARGURA. O mesmo cálculo roda no preview e no render final, então o carimbo ocupa a
 * mesma proporção em qualquer resolução (RNF-04/RNF-05).
 */
import type { SectionConfig } from './types'

export interface Size {
  width: number
  height: number
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** Fração da largura → px. */
export function pctToPx(pct: number, imageWidth: number): number {
  return pct * imageWidth
}

/** px → fração da largura. */
export function pxToPct(px: number, imageWidth: number): number {
  return imageWidth === 0 ? 0 : px / imageWidth
}

/** Mantém um valor relativo dentro de 0..limite. */
export function clampPct(value: number, max = 1): number {
  return Math.min(Math.max(value, 0), max)
}

/** Tipo de linha no carimbo (campos e divisores têm alturas diferentes). */
export type SectionRowKind = 'field' | 'divider'

export interface SectionMetrics extends Box {
  fontSize: number
  lineHeight: number
  /** Altura reservada para um divisor (a linha em si é mais fina, centrada). */
  dividerHeight: number
  lineGap: number
  padding: number
  iconSize: number
  iconGap: number
  /** Onde começa o conteúdo (texto/ícones) dentro da caixa. */
  contentX: number
  contentY: number
  radius: number
  /** Altura de cada linha na ordem passada (para posicionar no SVG). */
  rowHeights: number[]
}

/**
 * Traduz a seção para px de uma imagem de `size`, dada a sequência de linhas visíveis.
 * A altura é consequência do conteúdo — o usuário controla largura, fonte e espaçamentos.
 */
export function sectionMetrics(
  section: SectionConfig,
  size: Size,
  rows: readonly SectionRowKind[]
): SectionMetrics {
  const fontSize = pctToPx(section.fontPct, size.width)
  const lineGap = pctToPx(section.lineGapPct, size.width)
  const padding = pctToPx(section.paddingPct, size.width)
  const iconSize = fontSize * 1.15
  const iconGap = fontSize * 0.45
  const lineHeight = Math.max(fontSize, iconSize)
  const dividerHeight = Math.max(fontSize * 0.45, 2)

  const width = pctToPx(section.widthPct, size.width)
  const rowHeights = rows.map((kind) => (kind === 'divider' ? dividerHeight : lineHeight))
  const contentHeight =
    rowHeights.length === 0
      ? 0
      : rowHeights.reduce((sum, h) => sum + h, 0) + Math.max(rowHeights.length - 1, 0) * lineGap
  const height = contentHeight + padding * 2

  const x = section.x * size.width
  const y = section.y * size.height
  // SVG arredonda além de metade do lado menor — limita para o slider não "estourar" o card
  const radius = Math.min(pctToPx(section.radiusPct, size.width), width / 2, height / 2)

  return {
    x,
    y,
    width,
    height,
    fontSize,
    lineHeight,
    dividerHeight,
    lineGap,
    padding,
    iconSize,
    iconGap,
    contentX: x + padding,
    contentY: y + padding,
    radius,
    rowHeights
  }
}

/** Caixa da logo em px (a altura sai da proporção da imagem da logo). */
export function logoBox(
  logo: { x: number; y: number; widthPct: number },
  size: Size,
  aspectRatio: number
): Box {
  const width = pctToPx(logo.widthPct, size.width)
  return {
    x: logo.x * size.width,
    y: logo.y * size.height,
    width,
    height: aspectRatio > 0 ? width / aspectRatio : width
  }
}

/** Box em px → box relativo (0..1), para gravar de volta no `Template`. */
export function boxToRelative(box: Box, size: Size): Box {
  return {
    x: box.x / size.width,
    y: box.y / size.height,
    width: box.width / size.width,
    height: box.height / size.height
  }
}
