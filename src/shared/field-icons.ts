import type { FieldKey } from './types'

/**
 * Ícone FIXO por campo (REQUISITOS.md §3 / ARQUITETURA.md §9).
 * Nomes no padrão Lucide kebab-case: o Renderer usa `lucide-react` e o render final
 * usará os mesmos SVGs via `lucide-static` — mesma origem = preview igual à saída.
 */
export const FIELD_ICON: Record<FieldKey, string> = {
  latitude: 'map-pin',
  longitude: 'map-pin',
  altitude: 'mountain',
  date: 'calendar',
  time: 'clock',
  model: 'plane',
  direction: 'compass'
}

/** Rótulo PT-BR de cada campo (RNF-07). */
export const FIELD_LABEL: Record<FieldKey, string> = {
  latitude: 'Latitude',
  longitude: 'Longitude',
  altitude: 'Altitude',
  date: 'Data',
  time: 'Hora',
  model: 'Modelo',
  direction: 'Direção'
}

/** Ordem padrão dos campos (o DnD do editor reordena a cópia no `Template`). */
export const FIELD_ORDER: readonly FieldKey[] = [
  'latitude',
  'longitude',
  'altitude',
  'date',
  'time',
  'model',
  'direction'
]
