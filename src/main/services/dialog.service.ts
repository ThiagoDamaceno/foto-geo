import { dialog, type BrowserWindow } from 'electron'
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

/** Seletor da logo (RF-06). Devolve `null` quando o usuário cancela. */
export async function pickLogo(parent: BrowserWindow | null): Promise<LogoAsset | null> {
  const [file] = await showOpen(parent, {
    title: 'Selecionar logo',
    buttonLabel: 'Usar',
    properties: ['openFile'],
    filters: [{ name: 'Logo (PNG/SVG)', extensions: LOGO_EXTENSIONS.map((e) => e.slice(1)) }]
  })

  return file ? loadLogoAsset(file) : null
}

interface OpenOptions {
  title: string
  buttonLabel: string
  properties: ('openFile' | 'openDirectory' | 'multiSelections')[]
  filters?: { name: string; extensions: string[] }[]
}

async function showOpen(parent: BrowserWindow | null, options: OpenOptions): Promise<string[]> {
  const { canceled, filePaths } = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)

  return canceled ? [] : filePaths
}
