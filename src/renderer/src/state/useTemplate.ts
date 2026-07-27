import { useCallback, useRef, useState } from 'react'
import { clampPct } from '@shared/geometry'
import { createLogo } from '@shared/logo-items'
import { createDivider } from '@shared/section-items'
import { cloneDefaultTemplate } from '@shared/template-defaults'
import { isDivider } from '@shared/types'
import type {
  DividerConfig,
  FieldConfig,
  FieldKey,
  LogoAsset,
  LogoConfig,
  SectionConfig,
  Template
} from '@shared/types'

export interface TemplateState {
  template: Template
  /** Logos rasterizadas, indexadas por `LogoConfig.id`. */
  logoAssets: Record<string, LogoAsset>
  moveSection: (x: number, y: number) => void
  resizeSection: (widthPct: number) => void
  /** Nome do perfil (é o que vai para o `.json` — RF-07). */
  setName: (name: string) => void
  /** Altera uma ou mais propriedades da seção (fonte, cores, espaçamentos). */
  patchSection: (patch: Partial<SectionConfig>) => void
  /** Nova ordem vertical dos itens (campos + divisores — o DnD chama isto). */
  reorderFields: (from: number, to: number) => void
  /** Liga/desliga `visible`, `showIcon` ou `showLabel` de um campo. */
  patchField: (key: FieldKey, patch: Partial<Omit<FieldConfig, 'key'>>) => void
  /** Insere um divisor no fim da lista (dá para arrastar para o lugar certo). */
  addDivider: () => void
  patchDivider: (id: string, patch: Partial<Omit<DividerConfig, 'type' | 'id'>>) => void
  removeDivider: (id: string) => void
  /** Insere logos no topo da pilha (ficam por cima). */
  addLogos: (assets: LogoAsset[]) => void
  /** Ordem = empilhamento (0 = frente). */
  reorderLogos: (from: number, to: number) => void
  patchLogo: (id: string, patch: Partial<Omit<LogoConfig, 'id' | 'filePath'>>) => void
  removeLogo: (id: string) => void
  moveLogo: (id: string, x: number, y: number) => void
  resizeLogo: (id: string, widthPct: number) => void
  /**
   * Substitui tudo de uma vez — é assim que um perfil carregado entra no editor (RF-07).
   * As logos vêm junto porque o `Template` só guarda os caminhos.
   */
  applyTemplate: (template: Template, logos: LogoAsset[]) => void
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
  const [logoAssets, setLogoAssets] = useState<Record<string, LogoAsset>>({})
  // ref espelha o template: `createLogo` (UUID) não pode rodar dentro do updater do
  // setState — no StrictMode o updater roda 2× e os ids da lista e dos assets divergem.
  const templateRef = useRef(template)
  templateRef.current = template

  const setName = useCallback((name: string): void => {
    setTemplate((current) => ({ ...current, name }))
  }, [])

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
          fields: current.section.fields.map((item) =>
            isDivider(item) || item.key !== key ? item : { ...item, ...patch }
          )
        }
      }))
    },
    []
  )

  const addDivider = useCallback((): void => {
    // id fora do updater — StrictMode chama o updater 2× e duplicaria o divisor
    const divider = createDivider()
    setTemplate((current) => ({
      ...current,
      section: {
        ...current.section,
        fields: [...current.section.fields, divider]
      }
    }))
  }, [])

  const patchDivider = useCallback(
    (id: string, patch: Partial<Omit<DividerConfig, 'type' | 'id'>>): void => {
      setTemplate((current) => ({
        ...current,
        section: {
          ...current.section,
          fields: current.section.fields.map((item) =>
            isDivider(item) && item.id === id ? { ...item, ...patch } : item
          )
        }
      }))
    },
    []
  )

  const removeDivider = useCallback((id: string): void => {
    setTemplate((current) => ({
      ...current,
      section: {
        ...current.section,
        fields: current.section.fields.filter((item) => !isDivider(item) || item.id !== id)
      }
    }))
  }, [])

  const addLogos = useCallback((assets: LogoAsset[]): void => {
    if (assets.length === 0) return

    const stackBase = templateRef.current.logos.length
    const added = assets.map((asset, index) => createLogo(asset.filePath, stackBase + index))

    setLogoAssets((prev) => {
      const next = { ...prev }
      added.forEach((logo, index) => {
        const asset = assets[index]
        if (asset) next[logo.id] = asset
      })
      return next
    })
    // novas no topo da pilha (ficam por cima)
    setTemplate((current) => ({ ...current, logos: [...added, ...current.logos] }))
  }, [])

  const reorderLogos = useCallback((from: number, to: number): void => {
    setTemplate((current) => {
      const logos = [...current.logos]
      const [moved] = logos.splice(from, 1)
      if (!moved) return current
      logos.splice(to, 0, moved)
      return { ...current, logos }
    })
  }, [])

  const patchLogo = useCallback(
    (id: string, patch: Partial<Omit<LogoConfig, 'id' | 'filePath'>>): void => {
      const next = { ...patch }
      if (next.x !== undefined) next.x = clampPct(next.x)
      if (next.y !== undefined) next.y = clampPct(next.y)
      if (next.widthPct !== undefined) next.widthPct = clamp(next.widthPct, MIN_LOGO_WIDTH, 1)
      if (next.opacity !== undefined) next.opacity = clamp(next.opacity, 0, 1)

      setTemplate((current) => ({
        ...current,
        logos: current.logos.map((logo) => (logo.id === id ? { ...logo, ...next } : logo))
      }))
    },
    []
  )

  const removeLogo = useCallback((id: string): void => {
    setTemplate((current) => ({
      ...current,
      logos: current.logos.filter((logo) => logo.id !== id)
    }))
    setLogoAssets((current) => {
      const { [id]: _removed, ...rest } = current
      return rest
    })
  }, [])

  const moveLogo = useCallback(
    (id: string, x: number, y: number): void => {
      patchLogo(id, { x: clampPct(x), y: clampPct(y) })
    },
    [patchLogo]
  )

  const resizeLogo = useCallback(
    (id: string, widthPct: number): void => {
      patchLogo(id, { widthPct: clamp(widthPct, MIN_LOGO_WIDTH, 1) })
    },
    [patchLogo]
  )

  const applyTemplate = useCallback((next: Template, logos: LogoAsset[]): void => {
    setTemplate(next)
    const byId: Record<string, LogoAsset> = {}
    for (const asset of logos) {
      if (asset.id) byId[asset.id] = asset
    }
    // fallback por caminho (perfis antigos / assets sem id)
    for (const logo of next.logos) {
      if (byId[logo.id]) continue
      const asset = logos.find(
        (item) => item.filePath === logo.filePath || item.filePath.endsWith(logo.filePath)
      )
      if (asset) byId[logo.id] = asset
    }
    setLogoAssets(byId)
  }, [])

  const reset = useCallback((): void => {
    setTemplate(cloneDefaultTemplate())
    setLogoAssets({})
  }, [])

  return {
    template,
    logoAssets,
    setName,
    moveSection,
    resizeSection,
    patchSection,
    reorderFields,
    patchField,
    addDivider,
    patchDivider,
    removeDivider,
    addLogos,
    reorderLogos,
    patchLogo,
    removeLogo,
    moveLogo,
    resizeLogo,
    applyTemplate,
    reset
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
