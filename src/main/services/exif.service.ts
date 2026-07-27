import { basename } from 'node:path'
import { stat } from 'node:fs/promises'
import { ExifTool, type Tags } from 'exiftool-vendored'
import { normalizeDegrees } from '@shared/format'
import type { FieldKey, PhotoMetadata } from '@shared/types'

/**
 * Leitura de telemetria (RF-02).
 *
 * Regra de ouro (ARQUITETURA.md §15): **XMP `drone-dji` primeiro, EXIF como fallback**.
 * O `exiftool` entrega as tags achatadas; quando o mesmo nome existe nos dois blocos, o XMP
 * vence — por isso os campos DJI (`AbsoluteAltitude`, `GimbalYawDegree`, `ProductName`…)
 * são lidos direto, e o EXIF só aparece nos fallbacks explícitos abaixo.
 */

/** Uma instância só para o app inteiro; o batch-cluster interno cuida da concorrência. */
let exiftool: ExifTool | null = null

function getExifTool(): ExifTool {
  exiftool ??= new ExifTool({ maxProcs: 2, taskTimeoutMillis: 20_000 })
  return exiftool
}

/** Encerra os processos do exiftool (chamado no `will-quit`). */
export async function disposeExifTool(): Promise<void> {
  const instance = exiftool
  exiftool = null
  if (instance) await instance.end()
}

/** Lê a telemetria de vários arquivos; uma foto ruim não derruba as outras (RNF-08). */
export async function scanPhotos(filePaths: string[]): Promise<PhotoMetadata[]> {
  return Promise.all(filePaths.map(readPhotoMetadata))
}

/** Lê a telemetria de um arquivo. Nunca rejeita: erro vira `error` no resultado. */
export async function readPhotoMetadata(filePath: string): Promise<PhotoMetadata> {
  const fileName = basename(filePath)
  const base: PhotoMetadata = {
    filePath,
    fileName,
    fileSize: 0,
    width: 0,
    height: 0,
    present: []
  }

  try {
    base.fileSize = (await stat(filePath)).size
  } catch {
    return { ...base, error: 'Arquivo inacessível' }
  }

  let tags: RawTags
  try {
    tags = (await getExifTool().read(filePath)) as RawTags
  } catch (error) {
    return { ...base, error: `Falha ao ler metadados: ${messageOf(error)}` }
  }

  // Dimensões **após** orientação EXIF (igual ao `.rotate()` do Sharp no render) —
  // orientations 5–8 trocam largura/altura; sem isso o overlay diverge da saída.
  const rawWidth = num(tags.ImageWidth) ?? num(tags.ExifImageWidth) ?? 0
  const rawHeight = num(tags.ImageHeight) ?? num(tags.ExifImageHeight) ?? 0
  const orientation = num(tags.Orientation) ?? 1
  const swap = orientation >= 5 && orientation <= 8

  const photo: PhotoMetadata = {
    ...base,
    width: swap ? rawHeight : rawWidth,
    height: swap ? rawWidth : rawHeight,
    ...readCoordinates(tags),
    ...readAltitudes(tags),
    present: []
  }

  const dateTime = readDateTime(tags)
  if (dateTime) photo.dateTimeOriginal = dateTime

  const direction = readDirection(tags)
  if (direction !== undefined) photo.direction = direction

  const model = readModel(tags)
  if (model) photo.droneModel = model

  const photoNumber = readPhotoNumber(fileName)
  if (photoNumber) photo.photoNumber = photoNumber

  photo.present = presentFields(photo)

  // O exiftool não lança em arquivo corrompido — reporta em `errors` (RNF-08).
  const errors = Array.isArray(tags.errors) ? tags.errors.filter((e) => typeof e === 'string') : []
  if (errors.length > 0) photo.error = errors.join(' · ')

  return photo
}

/** Quais campos têm valor nesta foto (RF-02). */
function presentFields(photo: PhotoMetadata): FieldKey[] {
  const present: FieldKey[] = []
  if (photo.latitude !== undefined) present.push('latitude')
  if (photo.longitude !== undefined) present.push('longitude')
  if (photo.absoluteAltitude !== undefined || photo.relativeAltitude !== undefined) {
    present.push('altitude')
  }
  if (photo.dateTimeOriginal) present.push('date', 'time')
  if (photo.droneModel) present.push('model')
  if (photo.direction !== undefined) present.push('direction')
  return present
}

/**
 * GPS em graus decimais com sinal. O exiftool já aplica o hemisfério, mas fotos com
 * `GPSLatitudeRef = S/W` e valor positivo aparecem em alguns arquivos — daí a correção.
 */
function readCoordinates(tags: RawTags): Pick<PhotoMetadata, 'latitude' | 'longitude'> {
  const latitude = applyHemisphere(num(tags.GpsLatitude) ?? num(tags.GPSLatitude), tags.GPSLatitudeRef)
  const longitude = applyHemisphere(
    num(tags.GpsLongitude) ?? num(tags.GPSLongitude),
    tags.GPSLongitudeRef
  )

  // 0/0 é o "sem fix" da DJI — não é posição válida
  if (latitude === 0 && longitude === 0) return {}

  return {
    ...(latitude === undefined ? {} : { latitude }),
    ...(longitude === undefined ? {} : { longitude })
  }
}

function applyHemisphere(value: number | undefined, ref: unknown): number | undefined {
  if (value === undefined) return undefined
  const hemisphere = str(ref)?.trim().charAt(0).toUpperCase()
  const isNegative = hemisphere === 'S' || hemisphere === 'W'
  return isNegative && value > 0 ? -value : value
}

/** Altitude absoluta (padrão do carimbo) e relativa à decolagem. */
function readAltitudes(
  tags: RawTags
): Pick<PhotoMetadata, 'absoluteAltitude' | 'relativeAltitude'> {
  // XMP vem como string com sinal ("+613.504"); GPSAltitude é numérico
  const absolute = num(tags.AbsoluteAltitude) ?? num(tags.GPSAltitude)
  const relative = num(tags.RelativeAltitude)

  return {
    ...(absolute === undefined ? {} : { absoluteAltitude: absolute }),
    ...(relative === undefined ? {} : { relativeAltitude: relative })
  }
}

/** Rumo da câmera; `GPSImgDirection` não existe nas fotos DJI da amostra. */
function readDirection(tags: RawTags): number | undefined {
  const raw = num(tags.GimbalYawDegree) ?? num(tags.FlightYawDegree) ?? num(tags.GPSImgDirection)
  return raw === undefined ? undefined : normalizeDegrees(raw)
}

/** Nome amigável do drone; `Make`+`Model` só como fallback (`DJI FC9589`). */
function readModel(tags: RawTags): string | undefined {
  const productName = str(tags.ProductName)
  if (productName) return productName

  const parts = [str(tags.Make), str(tags.Model)].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : undefined
}

/**
 * Data/hora **da câmera**, preservando o fuso original — nada de `new Date()`, que
 * reinterpretaria a hora no fuso do PC.
 */
function readDateTime(tags: RawTags): string | undefined {
  for (const candidate of [tags.DateTimeOriginal, tags.CreateDate, tags.ModifyDate]) {
    const iso = toIsoString(candidate)
    if (iso) return iso
  }
  return undefined
}

function toIsoString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    // formato EXIF cru: "2026:07:18 15:56:23"
    const match = /^(\d{4})[:-](\d{2})[:-](\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(value)
    if (!match) return undefined
    const [, year, month, day, hour, minute, second] = match
    return `${year}-${month}-${day}T${hour}:${minute}:${second}`
  }

  if (value && typeof value === 'object' && 'toISOString' in value) {
    const iso = (value as { toISOString: () => string | undefined }).toISOString()
    if (typeof iso === 'string') return iso
  }

  return undefined
}

/** `dji_fly_20260718_155626_0253_…` → `0253`. */
function readPhotoNumber(fileName: string): string | undefined {
  const match = /_(\d{4})_\d+_/.exec(fileName)
  return match?.[1]
}

/**
 * As tags DJI do XMP não estão na tipagem do `exiftool-vendored` (é um namespace
 * proprietário), então o acesso é via índice + conversão explícita.
 */
type RawTags = Tags & Record<string, unknown>

/** Aceita número ou string com sinal (`"+613.504"`, `"-60.30"`). */
function num(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
