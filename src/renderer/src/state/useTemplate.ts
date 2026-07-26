import { useCallback, useState } from 'react'
import { clampPct } from '@shared/geometry'
import { cloneDefaultTemplate } from '@shared/template-defaults'
import type { Template } from '@shared/types'

export interface TemplateState {
  template: Template
  /** Move a seção (valores relativos 0..1, já limitados à imagem). */
  moveSection: (x: number, y: number) => void
  /** Redimensiona a seção pela largura relativa. */
  resizeSection: (widthPct: number) => void
  reset: () => void
}

/**
 * Estado do template em edição. Só posição/tamanho da seção por enquanto — fonte, cores,
 * ordem dos campos e logo entram com o inspector (passo 5 do ARQUITETURA.md §14).
 */
export function useTemplate(): TemplateState {
  const [template, setTemplate] = useState<Template>(cloneDefaultTemplate)

  const moveSection = useCallback((x: number, y: number): void => {
    setTemplate((current) => ({
      ...current,
      section: { ...current.section, x: clampPct(x), y: clampPct(y) }
    }))
  }, [])

  const resizeSection = useCallback((widthPct: number): void => {
    setTemplate((current) => ({
      ...current,
      section: { ...current.section, widthPct: Math.min(Math.max(widthPct, 0.08), 1) }
    }))
  }, [])

  const reset = useCallback((): void => setTemplate(cloneDefaultTemplate()), [])

  return { template, moveSection, resizeSection, reset }
}
