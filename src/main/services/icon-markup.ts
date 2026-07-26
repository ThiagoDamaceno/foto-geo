import { Calendar, Clock, Compass, MapPin, Mountain, Plane } from 'lucide-static'
import { FIELD_ICON, FIELD_ORDER } from '@shared/field-icons'
import { extractIconMarkup } from '@shared/overlay-svg'
import type { FieldKey } from '@shared/types'

/**
 * Ícones do carimbo no lado do Main (ARQUITETURA.md §9).
 * Mesma origem do Renderer — o `lucide-static` — e mesma função de extração, então o markup
 * que vai para o Sharp é idêntico ao que aparece no preview.
 */
const BY_NAME: Record<string, string> = {
  'map-pin': MapPin,
  mountain: Mountain,
  calendar: Calendar,
  clock: Clock,
  plane: Plane,
  compass: Compass
}

export const ICON_MARKUP: Record<FieldKey, string> = Object.fromEntries(
  FIELD_ORDER.map((key) => [key, extractIconMarkup(BY_NAME[FIELD_ICON[key]] ?? '')])
) as Record<FieldKey, string>
