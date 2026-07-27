#!/usr/bin/env node
/**
 * Escolhe o caminho certo:
 * - Windows → scripts/dist-win.ps1 (nativo)
 * - Linux/macOS/WSL → scripts/dist-win.sh (Docker)
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const isWin = process.platform === 'win32'

const command = isWin
  ? {
      file: 'powershell.exe',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts', 'dist-win.ps1')]
    }
  : {
      file: 'bash',
      args: [join(root, 'scripts', 'dist-win.sh')]
    }

console.log(
  isWin
    ? '==> Host Windows → build nativo'
    : '==> Host Linux/macOS/WSL → build via Docker'
)

const child = spawn(command.file, command.args, {
  cwd: root,
  stdio: 'inherit',
  shell: false
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
