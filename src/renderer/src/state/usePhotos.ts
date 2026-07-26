import { useCallback, useState } from 'react'
import type { PhotoMetadata, ScanResult } from '@shared/types'

export interface IgnoredPath {
  filePath: string
  reason: string
}

export interface PhotosState {
  photos: PhotoMetadata[]
  ignored: IgnoredPath[]
  isScanning: boolean
  error: string | null
  /** Importa arquivos e/ou pastas (o Main expande e valida). */
  importPaths: (paths: string[]) => Promise<void>
  pickImages: () => Promise<void>
  pickFolder: () => Promise<void>
  removePhoto: (filePath: string) => void
  clear: () => void
}

/**
 * Lote importado (RF-01/RF-02). Estado local por enquanto — o store do `Template`
 * (Zustand) entra junto com o editor, no passo 5 do ARQUITETURA.md §14.
 */
export function usePhotos(): PhotosState {
  const [photos, setPhotos] = useState<PhotoMetadata[]>([])
  const [ignored, setIgnored] = useState<IgnoredPath[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const importPaths = useCallback(async (paths: string[]): Promise<void> => {
    if (paths.length === 0) return

    setIsScanning(true)
    setError(null)
    try {
      const result: ScanResult = await window.fotoGeo.scanPhotos(paths)
      setPhotos((current) => mergePhotos(current, result.photos))
      setIgnored(result.ignored)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setIsScanning(false)
    }
  }, [])

  const pickImages = useCallback(async (): Promise<void> => {
    await pick(() => window.fotoGeo.pickImages(), importPaths, setError)
  }, [importPaths])

  const pickFolder = useCallback(async (): Promise<void> => {
    await pick(() => window.fotoGeo.pickFolder(), importPaths, setError)
  }, [importPaths])

  const removePhoto = useCallback((filePath: string): void => {
    setPhotos((current) => current.filter((photo) => photo.filePath !== filePath))
  }, [])

  const clear = useCallback((): void => {
    setPhotos([])
    setIgnored([])
    setError(null)
  }, [])

  return { photos, ignored, isScanning, error, importPaths, pickImages, pickFolder, removePhoto, clear }
}

/**
 * Roda o seletor e importa o resultado. Falha do IPC vira mensagem na tela — sem console
 * (RNF-10), uma exceção solta deixaria a janela em branco sem pista nenhuma.
 */
async function pick(
  select: () => Promise<string[]>,
  importPaths: (paths: string[]) => Promise<void>,
  setError: (message: string) => void
): Promise<void> {
  try {
    await importPaths(await select())
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : String(cause))
  }
}

/** Reimportar a mesma foto atualiza o registro em vez de duplicar. */
function mergePhotos(current: PhotoMetadata[], incoming: PhotoMetadata[]): PhotoMetadata[] {
  const byPath = new Map(current.map((photo) => [photo.filePath, photo]))
  incoming.forEach((photo) => byPath.set(photo.filePath, photo))

  return [...byPath.values()].sort((a, b) => a.fileName.localeCompare(b.fileName, 'pt-BR'))
}
