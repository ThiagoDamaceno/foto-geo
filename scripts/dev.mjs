/**
 * Wrapper do `electron-vite` que no Linux descarta o spam de GLib/Sharp no stderr.
 *
 * Esses avisos vêm do Electron vazando símbolos da GLib do sistema para o processo,
 * onde o libvips do sharp também traz a sua — conflito documentado pelo próprio sharp
 * (https://sharp.pixelplumbing.com/install/#electron-and-linux) e sem correção no app.
 * No Windows (alvo do produto) não aparecem; o filtro só roda em linux.
 */
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const args = process.argv.slice(2)
const child = spawn('yarn', ['electron-vite', ...args], {
  stdio: ['inherit', 'inherit', process.platform === 'linux' ? 'pipe' : 'inherit'],
  env: process.env
})

if (child.stderr) {
  const noise = /GLib-GObject:|\[SharpElectronLinux\]/
  createInterface({ input: child.stderr }).on('line', (line) => {
    if (!noise.test(line)) process.stderr.write(`${line}\n`)
  })
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
