import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/**
 * Tem de correr **antes** de `require('sharp')` — o libvips/fontconfig lê o env
 * na 1ª carga. Por isso o Main faz bootstrap e só depois importa os handlers.
 *
 * `FONTCONFIG_PATH` = pasta que contém `fonts.conf` (doc do Sharp).
 */

export function setupFontsBeforeSharp(): string {
  const fontsDir = resolveFontsDirSync()
  const confDir = join(app.getPath('userData'), 'fontconfig')
  const cacheDir = join(confDir, 'cache')
  mkdirSync(cacheDir, { recursive: true })

  const confPath = join(confDir, 'fonts.conf')
  const dirXml = escapeXml(toFcPath(fontsDir))
  const cacheXml = escapeXml(toFcPath(cacheDir))

  writeFileSync(
    confPath,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${dirXml}</dir>
  <cachedir>${cacheXml}</cachedir>
  <alias>
    <family>sans-serif</family>
    <prefer><family>Roboto</family></prefer>
  </alias>
  <match target="pattern">
    <test qual="any" name="family"><string>Roboto</string></test>
    <edit name="family" mode="assign" binding="strong"><string>Roboto</string></edit>
  </match>
</fontconfig>
`,
    'utf8'
  )

  // Sharp docs: PATH = diretório com fonts.conf; FILE = caminho do arquivo
  process.env.FONTCONFIG_PATH = confDir
  process.env.FONTCONFIG_FILE = confPath

  return fontsDir
}

export function resolveFontsDirSync(): string {
  const candidates = [
    // extraResources → resources/fonts
    join(process.resourcesPath, 'fonts'),
    // asarUnpack (fallback)
    join(process.resourcesPath, 'app.asar.unpacked', 'assets', 'fonts'),
    join(app.getAppPath().replace(/app\.asar$/i, 'app.asar.unpacked'), 'assets', 'fonts'),
    join(app.getAppPath(), 'assets', 'fonts'),
    // electron-vite: out/main → ../../assets/fonts
    join(__dirname, '../../assets/fonts')
  ]

  for (const dir of candidates) {
    if (existsSync(join(dir, 'roboto.ttf'))) return dir
  }

  throw new Error(
    `Fonte Roboto não encontrada. Tentou:\n${candidates.map((c) => `  - ${c}`).join('\n')}`
  )
}

function toFcPath(path: string): string {
  return path.replace(/\\/g, '/')
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}
