import type { Dirent } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { isSupportedImage } from '@shared/image-formats'

/** Profundidade máxima ao expandir pastas arrastadas/selecionadas. */
const MAX_DEPTH = 4

export interface CollectedPaths {
  files: string[]
  ignored: { filePath: string; reason: string }[]
}

/**
 * Normaliza e valida os caminhos que chegam do Renderer (ARQUITETURA.md §11):
 * expande pastas, mantém só extensões suportadas (RF-01), remove duplicados e ordena.
 */
export async function collectImagePaths(paths: string[]): Promise<CollectedPaths> {
  const files = new Set<string>()
  const ignored: CollectedPaths['ignored'] = []

  for (const rawPath of paths) {
    if (typeof rawPath !== 'string' || rawPath.trim() === '' || !isAbsolute(rawPath)) {
      ignored.push({ filePath: String(rawPath), reason: 'Caminho inválido' })
      continue
    }

    const filePath = resolve(rawPath)

    let isDirectory: boolean
    try {
      isDirectory = (await stat(filePath)).isDirectory()
    } catch {
      ignored.push({ filePath, reason: 'Arquivo inacessível' })
      continue
    }

    if (isDirectory) {
      const found = await listImagesInFolder(filePath)
      if (found.length === 0) {
        ignored.push({ filePath, reason: 'Pasta sem imagens suportadas' })
      }
      found.forEach((f) => files.add(f))
      continue
    }

    if (!isSupportedImage(filePath)) {
      ignored.push({ filePath, reason: 'Formato não suportado' })
      continue
    }

    files.add(filePath)
  }

  return { files: [...files].sort(), ignored }
}

/** Lista as imagens de uma pasta (percorre subpastas até `MAX_DEPTH`). */
export async function listImagesInFolder(dir: string, depth = 0): Promise<string[]> {
  let entries: Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const found: string[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const entryPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      if (depth < MAX_DEPTH) found.push(...(await listImagesInFolder(entryPath, depth + 1)))
      continue
    }

    if (entry.isFile() && isSupportedImage(entryPath)) found.push(entryPath)
  }

  return found.sort()
}
