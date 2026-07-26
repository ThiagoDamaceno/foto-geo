import calendar from 'lucide-static/icons/calendar.svg?raw'
import clock from 'lucide-static/icons/clock.svg?raw'
import compass from 'lucide-static/icons/compass.svg?raw'
import mapPin from 'lucide-static/icons/map-pin.svg?raw'
import mountain from 'lucide-static/icons/mountain.svg?raw'
import plane from 'lucide-static/icons/plane.svg?raw'
import { FIELD_ICON, FIELD_ORDER } from '@shared/field-icons'
import { extractIconMarkup } from '@shared/overlay-svg'
import type { FieldKey } from '@shared/types'

/**
 * Ícones do carimbo no lado do Renderer. São os MESMOS arquivos que o Main usa
 * (`lucide-static`), passados pela mesma extração — ver `main/services/icon-markup.ts`.
 * Nada a ver com o `lucide-react` de `lib/field-icons.ts`, que é só a UI do app.
 */
const BY_NAME: Record<string, string> = {
  'map-pin': mapPin,
  mountain,
  calendar,
  clock,
  plane,
  compass
}

export const ICON_MARKUP: Record<FieldKey, string> = Object.fromEntries(
  FIELD_ORDER.map((key) => [key, extractIconMarkup(BY_NAME[FIELD_ICON[key]] ?? '')])
) as Record<FieldKey, string>
