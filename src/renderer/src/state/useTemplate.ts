import { useCallback, useState } from 'react'
import { clampPct } from '@shared/geometry'
import { cloneDefaultTemplate } from '@shared/template-defaults'
import type { FieldConfig, FieldKey, LogoAsset, SectionConfig, Template } from '@shared/types'

export interface TemplateState {
  template: Template
  /** Logo carregada (PNG pronto para o carimbo); `null` quando o perfil não tem logo. */
  logoAsset: LogoAsset | null
  moveSection: (x: number, y: number) => void
  resizeSection: (widthPct: number) => void
  /** Altera uma ou mais propriedades da seção (fonte, cores, espaçamentos). */
  patchSection: (patch: Partial<SectionConfig>) => void
  /** Nova ordem vertical dos campos (o DnD chama isto — RF-04). */
  reorderFields: (from: number, to: number) => void
  /** Liga/desliga `visible`, `showIcon` ou `showLabel` de um campo. */
  patchField: (key: FieldKey, patch: Partial<Omit<FieldConfig, 'key'>>) => void
  moveLogo: (x: number, y: number) => void
  resizeLogo: (widthPct: number) => void
  setLogoOpacity: (opacity: number) => void
  setLogoAsset: (asset: LogoAsset | null) => void
  reset: () => void
}

const MIN_SECTION_WIDTH = 0.08
const MIN_LOGO_WIDTH = 0.02

/**
 * Template em edição (ARQUITETURA.md §6). `useState` ainda dá conta; se o inspector crescer
 * muito, virar Zustand é trocar só este arquivo.
 */
export function useTemplate(): TemplateState {
  const [template, setTemplate] = useState<Template>(cloneDefaultTemplate)
  const [logoAsset, setLogoAssetState] = useState<LogoAsset | null>(null)

  const patchSection = useCallback((patch: Partial<SectionConfig>): void => {
    setTemplate((current) => ({ ...current, section: { ...current.section, ...patch } }))
  }, [])

  const moveSection = useCallback(
    (x: number, y: number): void => {
      patchSection({ x: clampPct(x), y: clampPct(y) })
    },
    [patchSection]
  )

  const resizeSection = useCallback(
    (widthPct: number): void => {
      patchSection({ widthPct: clamp(widthPct, MIN_SECTION_WIDTH, 1) })
    },
    [patchSection]
  )

  const reorderFields = useCallback((from: number, to: number): void => {
    setTemplate((current) => {
      const fields = [...current.section.fields]
      const [moved] = fields.splice(from, 1)
      if (!moved) return current
      fields.splice(to, 0, moved)
      return { ...current, section: { ...current.section, fields } }
    })
  }, [])

  const patchField = useCallback(
    (key: FieldKey, patch: Partial<Omit<FieldConfig, 'key'>>): void => {
      setTemplate((current) => ({
        ...current,
        section: {
          ...current.section,
          fields: current.section.fields.map((field) =>
            field.key === key ? { ...field, ...patch } : field
          )
        }
      }))
    },
    []
  )

  const patchLogo = useCallback((patch: Partial<Template['logo']>): void => {
    setTemplate((current) => ({ ...current, logo: { ...current.logo, ...patch } }))
  }, [])

  const moveLogo = useCallback(
    (x: number, y: number): void => {
      patchLogo({ x: clampPct(x), y: clampPct(y) })
    },
    [patchLogo]
  )

  const resizeLogo = useCallback(
    (widthPct: number): void => {
      patchLogo({ widthPct: clamp(widthPct, MIN_LOGO_WIDTH, 1) })
    },
    [patchLogo]
  )

  const setLogoOpacity = useCallback(
    (opacity: number): void => {
      patchLogo({ opacity: clamp(opacity, 0, 1) })
    },
    [patchLogo]
  )

  const setLogoAsset = useCallback(
    (asset: LogoAsset | null): void => {
      setLogoAssetState(asset)
      patchLogo({ filePath: asset?.filePath ?? null })
    },
    [patchLogo]
  )

  const reset = useCallback((): void => {
    setTemplate(cloneDefaultTemplate())
    setLogoAssetState(null)
  }, [])

  return {
    template,
    logoAsset,
    moveSection,
    resizeSection,
    patchSection,
    reorderFields,
    patchField,
    moveLogo,
    resizeLogo,
    setLogoOpacity,
    setLogoAsset,
    reset
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
