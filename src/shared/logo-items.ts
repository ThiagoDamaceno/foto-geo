import type { LogoConfig } from './types'

export function newLogoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `logo-${crypto.randomUUID()}`
  }
  return `logo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Novo item de logo com id único e posição padrão (ligeiramente deslocada por índice). */
export function createLogo(filePath: string, stackIndex = 0): LogoConfig {
  const nudge = Math.min(stackIndex, 8) * 0.04

  return {
    id: newLogoId(),
    filePath,
    x: Math.min(Math.max(0.7 - nudge, 0), 1),
    y: Math.min(Math.max(0.75 - nudge * 0.5, 0), 1),
    widthPct: 0.15,
    opacity: 1
  }
}
