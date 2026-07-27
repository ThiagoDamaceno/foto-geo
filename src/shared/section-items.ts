import type { DividerConfig, FieldConfig, SectionItem } from './types'
import { isDivider } from './types'

/** Id estável para o Sortable do DnD. */
export function itemSortId(item: SectionItem): string {
  return isDivider(item) ? item.id : item.key
}

export function asField(item: SectionItem): FieldConfig | null {
  return isDivider(item) ? null : item
}

/** Novo divisor com id único o bastante para a lista do perfil. */
export function createDivider(): DividerConfig {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `div-${crypto.randomUUID()}`
      : `div-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

  return { type: 'divider', id, visible: true }
}
