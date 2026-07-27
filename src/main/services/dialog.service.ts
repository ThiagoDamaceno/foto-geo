import { stat } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { dialog, shell, type BrowserWindow } from 'electron'
import { IMAGE_EXTENSIONS } from '@shared/image-formats'
import type { LogoAsset } from '@shared/types'
import { listImagesInFolder } from './files.service'
import { loadLogoAsset, LOGO_EXTENSIONS } from './logo.service'

/** Extensões sem o ponto, como o `dialog` espera. */
const FILTER_EXTENSIONS = IMAGE_EXTENSIONS.map((extension) => extension.slice(1))

/** Seletor de imagens (RF-01). Devolve `[]` quando o usuário cancela. */
export async function pickImages(parent: BrowserWindow | null): Promise<string[]> {
  const result = await showOpen(parent, {
    title: 'Selecionar fotos',
    buttonLabel: 'Importar',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Imagens', extensions: FILTER_EXTENSIONS },
      { name: 'Todos os arquivos', extensions: ['*'] }
    ]
  })

  return result
}

/** Seletor de pasta: devolve as imagens encontradas dentro dela (RF-01). */
export async function pickFolder(parent: BrowserWindow | null): Promise<string[]> {
  const [folder] = await showOpen(parent, {
    title: 'Selecionar pasta com fotos',
    buttonLabel: 'Importar',
    properties: ['openDirectory']
  })

  return folder ? listImagesInFolder(folder) : []
}

/** Seletor de logo(s) (RF-06). Devolve `[]` quando o usuário cancela. */
export async function pickLogo(parent: BrowserWindow | null): Promise<LogoAsset[]> {
  const files = await showOpen(parent, {
    title: 'Selecionar logo(s)',
    buttonLabel: 'Usar',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Logo (PNG, SVG, WebP, JPEG…)', extensions: LOGO_EXTENSIONS.map((e) => e.slice(1)) }
    ]
  })

  const assets: LogoAsset[] = []
  for (const file of files) {
    assets.push(await loadLogoAsset(file))
  }
  return assets
}

/** Seletor da pasta de saída do lote (RF-09). Devolve `null` quando o usuário cancela. */
export async function pickOutputDir(parent: BrowserWindow | null): Promise<string | null> {
  const [folder] = await showOpen(parent, {
    title: 'Escolher pasta de saída',
    buttonLabel: 'Usar esta pasta',
    properties: ['openDirectory', 'createDirectory']
  })

  return folder ?? null
}

/**
 * Abre a pasta de saída no Explorer. **Só diretório**: `shell.openPath` num arquivo pediria ao
 * Windows para executá-lo, e o caminho vem do Renderer (ARQUITETURA.md §11).
 */
export async function openFolder(target: unknown): Promise<void> {
  if (typeof target !== 'string' || target.trim() === '' || !isAbsolute(target)) {
    throw new Error('Caminho inválido')
  }

  const folder = resolve(target)
  if (!(await stat(folder)).isDirectory()) throw new Error('O caminho não é uma pasta')

  const error = await shell.openPath(folder)
  if (error) throw new Error(error)
}

interface OpenOptions {
  title: string
  buttonLabel: string
  properties: ('openFile' | 'openDirectory' | 'multiSelections' | 'createDirectory')[]
  filters?: { name: string; extensions: string[] }[]
}

async function showOpen(parent: BrowserWindow | null, options: OpenOptions): Promise<string[]> {
  const { canceled, filePaths } = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)

  return canceled ? [] : filePaths
}
