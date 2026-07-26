import { Calendar, Clock, Compass, MapPin, Mountain, Plane, type LucideIcon } from 'lucide-react'
import { FIELD_ICON } from '@shared/field-icons'
import type { FieldKey } from '@shared/types'

/**
 * Componente Lucide de cada campo. É a contraparte no Renderer do mapa em
 * `shared/field-icons.ts` (nomes kebab-case) — o Main usará os mesmos ícones via
 * `lucide-static` no SVG do carimbo (ARQUITETURA.md §9).
 */
const BY_NAME: Record<string, LucideIcon> = {
  'map-pin': MapPin,
  mountain: Mountain,
  calendar: Calendar,
  clock: Clock,
  plane: Plane,
  compass: Compass
}

export function fieldIcon(key: FieldKey): LucideIcon {
  return BY_NAME[FIELD_ICON[key]] ?? MapPin
}
