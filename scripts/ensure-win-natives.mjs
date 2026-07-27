#!/usr/bin/env node
/**
 * Instala binários win32 no node_modules (sharp + exiftool), mesmo em host Linux.
 * Necessário porque yarn classic / npm pulam optionalDependencies de outro OS.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packages = [
  '@img/sharp-win32-x64@0.35.3',
  '@img/sharp-libvips-win32-x64@1.3.2',
  'exiftool-vendored.exe@13.59.0'
]

const result = spawnSync(
  'npm',
  [
    'install',
    '--no-save',
    '--os=win32',
    '--cpu=x64',
    ...packages
  ],
  { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const required = [
  'node_modules/@img/sharp-win32-x64',
  'node_modules/@img/sharp-libvips-win32-x64',
  'node_modules/exiftool-vendored.exe'
]

for (const rel of required) {
  if (!existsSync(join(root, rel))) {
    console.error(`ERRO: falta ${rel}`)
    process.exit(1)
  }
}

console.log('OK: nativos win32 presentes')
