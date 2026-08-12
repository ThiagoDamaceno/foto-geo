/**
 * Compressão da saída (RF-11) — **um único valor para todo o lote**.
 *
 * Fica em `shared` porque três lados precisam dos MESMOS limites: o slider do Renderer,
 * a estimativa de tamanho e o encoder JPEG do Main. Valor fora da faixa vira erro do Sharp.
 */

export const MIN_OUTPUT_QUALITY = 30
export const MAX_OUTPUT_QUALITY = 100

/**
 * Padrão do app: quase sem perda, perto do JPEG da câmera. Recompressão sempre reduz um
 * pouco o arquivo (23 MB → ~18–22 MB é o esperado neste valor).
 */
export const DEFAULT_OUTPUT_QUALITY = 98

/** Qualquer coisa vinda do Renderer/perfil vira um inteiro válido da faixa. */
export function clampQuality(value: unknown): number {
  const number =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.round(value)
      : DEFAULT_OUTPUT_QUALITY
  return Math.min(Math.max(number, MIN_OUTPUT_QUALITY), MAX_OUTPUT_QUALITY)
}

/**
 * Opções do encoder JPEG para uma qualidade.
 *
 * `4:4:4` (croma cheio) só de 90 para cima, onde o objetivo é fidelidade à original.
 * Abaixo disso o usuário está pedindo arquivo menor — manter croma cheio gastaria bytes
 * sem ganho visível, e é o `4:2:0` que faz a compressão realmente cair.
 */
export function jpegOptions(quality: number): {
  quality: number
  chromaSubsampling: '4:4:4' | '4:2:0'
} {
  const value = clampQuality(quality)
  return { quality: value, chromaSubsampling: value >= 90 ? '4:4:4' : '4:2:0' }
}
