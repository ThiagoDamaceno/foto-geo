import { mkdir } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { app } from 'electron'

/**
 * Raiz do app (ao lado do .exe / pasta do portable) ou do repositório em dev.
 * Usada para resolver logos com path relativo. `PORTABLE_EXECUTABLE_DIR` vem do
 * electron-builder portable.
 */
export function appRootDir(): string {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
  if (typeof portableDir === 'string' && portableDir.trim() !== '') {
    return portableDir
  }

  if (app.isPackaged) {
    return dirname(process.execPath)
  }

  // bundle em `out/main` → raiz do projeto
  return join(__dirname, '../..')
}

let profilesDirCache: string | null = null

/**
 * Pasta dos perfis `.json` em `userData/profiles`
 * (Windows: `%APPDATA%\<nome-do-app>\profiles`).
 */
export async function profilesDir(): Promise<string> {
  if (profilesDirCache) return profilesDirCache

  const dir = join(app.getPath('userData'), 'profiles')
  await mkdir(dir, { recursive: true })
  profilesDirCache = dir
  return dir
}

/** Caminho síncrono após `profilesDir()` ter sido chamado; senão, o padrão. */
export function profilesDirPath(): string {
  return profilesDirCache ?? join(app.getPath('userData'), 'profiles')
}

/** Path gravado no JSON: relativo à raiz do app quando possível. */
export function toStoredLogoPath(filePath: string): string {
  const absolute = resolveLogoPath(filePath)
  const rel = relative(appRootDir(), absolute)
  if (rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)) {
    return rel.split('\\').join('/')
  }
  return absolute
}

/** Path do perfil → absoluto para o Sharp / fs. */
export function resolveLogoPath(filePath: string): string {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new Error('Caminho de logo inválido')
  }
  return isAbsolute(filePath) ? resolve(filePath) : resolve(appRootDir(), filePath)
}
