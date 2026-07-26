/**
 * Formatos aceitos no import (RF-01).
 * JPG da DJI é o caso principal (EXIF + XMP `drone-dji`); os outros são secundários
 * e normalmente não trazem telemetria.
 */
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff', '.webp']

/** Extensões que costumam trazer telemetria — usado só para avisar o usuário. */
export const TELEMETRY_EXTENSIONS = ['.jpg', '.jpeg', '.tif', '.tiff']

function extensionOf(filePath: string): string {
  const dot = filePath.lastIndexOf('.')
  return dot === -1 ? '' : filePath.slice(dot).toLowerCase()
}

export function isSupportedImage(filePath: string): boolean {
  return IMAGE_EXTENSIONS.includes(extensionOf(filePath))
}

export function mayHaveTelemetry(filePath: string): boolean {
  return TELEMETRY_EXTENSIONS.includes(extensionOf(filePath))
}
