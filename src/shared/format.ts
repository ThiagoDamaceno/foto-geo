/**
 * Formatação dos valores de telemetria (RNF-07).
 *
 * Fica em `shared` de propósito: o Renderer usa para o preview e o Main usará para o SVG
 * do render final — a mesma string nos dois lados é parte da fidelidade preview↔saída
 * (RNF-05). Nada aqui depende de `Intl`/fuso do sistema.
 */
import type { FieldKey, PhotoMetadata } from './types'

/** Número no formato BR (vírgula decimal), sem separador de milhar. */
export function formatNumberBr(value: number, digits: number): string {
  return value.toFixed(digits).replace('.', ',')
}

/**
 * Graus decimais → DMS com hemisfério, ex. `-22.991331` → `22°59'28.79"S`.
 * O sinal define o hemisfério — dispensa os `*Ref` do EXIF.
 */
export function formatDms(decimal: number, axis: 'lat' | 'lon'): string {
  const hemisphere = axis === 'lat' ? (decimal < 0 ? 'S' : 'N') : decimal < 0 ? 'W' : 'E'
  const absolute = Math.abs(decimal)

  let degrees = Math.floor(absolute)
  let minutes = Math.floor((absolute - degrees) * 60)
  let seconds = Math.round(((absolute - degrees) * 60 - minutes) * 60 * 100) / 100

  // arredondamento pode estourar 60 (ex. 59.999" → 60.00")
  if (seconds >= 60) {
    seconds -= 60
    minutes += 1
  }
  if (minutes >= 60) {
    minutes -= 60
    degrees += 1
  }

  return `${degrees}°${String(minutes).padStart(2, '0')}'${seconds.toFixed(2).padStart(5, '0')}"${hemisphere}`
}

/** Metros → `621,5 m`. */
export function formatAltitude(meters: number): string {
  return `${formatNumberBr(meters, 1)} m`
}

/** Rumo em graus → `299,7°` (já normalizado no import). */
export function formatDirection(degrees: number): string {
  return `${formatNumberBr(normalizeDegrees(degrees), 1)}°`
}

/** Normaliza um ângulo qualquer para 0..360 (`-60.3` → `299.7`). */
export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360
}

/**
 * Parte o ISO da câmera sem passar por `Date` — o fuso do PC não pode mexer
 * na hora em que a foto foi tirada.
 */
function splitIso(iso: string): { date: string; time: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(iso)
  if (!match) return null
  const [, year, month, day, hour, minute, second] = match
  return { date: `${day}/${month}/${year}`, time: `${hour}:${minute}:${second ?? '00'}` }
}

/** ISO → `18/07/2026`. */
export function formatDate(iso: string): string | null {
  return splitIso(iso)?.date ?? null
}

/** ISO → `15:56:23`. */
export function formatTime(iso: string): string | null {
  return splitIso(iso)?.time ?? null
}

/**
 * Valor pronto de um campo para exibição/carimbo, ou `null` quando a foto não tem o dado.
 * Altitude usa a **absoluta** por padrão (REQUISITOS.md §3) e cai na relativa se faltar.
 */
export function formatFieldValue(key: FieldKey, photo: PhotoMetadata): string | null {
  switch (key) {
    case 'latitude':
      return photo.latitude === undefined ? null : formatDms(photo.latitude, 'lat')
    case 'longitude':
      return photo.longitude === undefined ? null : formatDms(photo.longitude, 'lon')
    case 'altitude': {
      const meters = photo.absoluteAltitude ?? photo.relativeAltitude
      return meters === undefined ? null : formatAltitude(meters)
    }
    case 'date':
      return photo.dateTimeOriginal ? formatDate(photo.dateTimeOriginal) : null
    case 'time':
      return photo.dateTimeOriginal ? formatTime(photo.dateTimeOriginal) : null
    case 'model':
      return photo.droneModel ?? null
    case 'direction':
      return photo.direction === undefined ? null : formatDirection(photo.direction)
  }
}

/** Bytes → `24,6 MB` (informativo na lista de import). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${formatNumberBr(bytes / 1024, 0)} KB`
  return `${formatNumberBr(bytes / (1024 * 1024), 1)} MB`
}
