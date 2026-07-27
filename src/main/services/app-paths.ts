import { access, mkdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { app } from 'electron'

/**
 * Raiz do app portátil (ao lado do .exe) ou do repositório em dev.
 * `PORTABLE_EXECUTABLE_DIR` vem do electron-builder portable.
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
 * Pasta `profiles/`: prefere ao lado do exe; se não for gravável (ex.: Program Files),
 * cai em `userData/profiles`.
 */
export async function profilesDir(): Promise<string> {
  if (profilesDirCache) return profilesDirCache

  const preferred = join(appRootDir(), 'profiles')
  if (await canUseProfilesDir(preferred)) {
    profilesDirCache = preferred
    return preferred
  }

  const fallback = join(app.getPath('userData'), 'profiles')
  await mkdir(fallback, { recursive: true })
  profilesDirCache = fallback
  return fallback
}

/** Caminho síncrono após `profilesDir()` ter sido chamado; senão, o preferido. */
export function profilesDirPath(): string {
  return profilesDirCache ?? join(appRootDir(), 'profiles')
}

/** Path gravado no JSON: relativo à raiz do app quando possível (kit portátil). */
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

async function canUseProfilesDir(dir: string): Promise<boolean> {
  try {
    await mkdir(dir, { recursive: true })
    const probe = join(dir, `.write-probe-${process.pid}`)
    await writeFile(probe, 'ok', 'utf8')
    await unlink(probe)
    await access(dir)
    return true
  } catch {
    return false
  }
}
