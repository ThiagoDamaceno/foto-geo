import type { FieldKey, Template } from './types'
import { FIELD_ORDER } from './field-icons'

/** Campos que aparecem com rótulo ("Latitude: …") no perfil padrão. */
const WITH_LABEL: readonly FieldKey[] = ['latitude', 'longitude', 'altitude']

/**
 * Perfil padrão (ARQUITETURA.md §8). Todos os números são **relativos** — as frações foram
 * escolhidas para caber com folga nas fotos do Lito X1 (8064 × 4536) e valem igual em
 * qualquer resolução (RNF-04).
 */
export const DEFAULT_TEMPLATE: Template = {
  name: 'Padrão',
  section: {
    x: 0.02,
    y: 0.63,
    widthPct: 0.3,
    fontFamily: 'Roboto',
    fontPct: 0.014,
    lineGapPct: 0.005,
    paddingPct: 0.01,
    /** Equivalente ao antigo `fontSize * 0.35` do geometry. */
    radiusPct: 0.005,
    showBorder: false,
    bgColor: '#000000',
    bgOpacity: 0.55,
    textColor: '#FFFFFF',
    align: 'left',
    fields: FIELD_ORDER.map((key) => ({
      key,
      visible: true,
      showIcon: true,
      showLabel: WITH_LABEL.includes(key)
    }))
  },
  logo: {
    filePath: null,
    x: 0.82,
    y: 0.86,
    widthPct: 0.15,
    opacity: 1
  }
}

/** Cópia profunda do padrão — evita que a UI mute o objeto compartilhado. */
export function cloneDefaultTemplate(): Template {
  return structuredClone(DEFAULT_TEMPLATE)
}
