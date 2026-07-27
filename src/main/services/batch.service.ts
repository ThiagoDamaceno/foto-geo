import { cpus } from 'node:os'
import { access, mkdir } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path'
import pLimitImport from 'p-limit'
import { formatFieldValue } from '@shared/format'
import { isDivider } from '@shared/types'
import type {
  BatchConfig,
  BatchIssue,
  JobProgress,
  JobResult,
  OutputNaming,
  PhotoMetadata,
  Template
} from '@shared/types'
import { readPhotoMetadata } from './exif.service'
import { collectImagePaths } from './files.service'
import { renderPhotoToFile } from './render.service'

/**
 * Aplicação em lote (RF-09) — ARQUITETURA.md §10.
 *
 * Regras que valem para todo lote:
 * - **o original nunca é tocado** (RF-10/RNF-03): a pasta de saída não pode ser a pasta de
 *   nenhuma foto de entrada, e isso é conferido antes de gravar qualquer coisa;
 * - **uma foto ruim não aborta o lote** (RNF-08): cada falha entra no resumo e o lote segue;
 * - a saída é sempre **JPEG** (é o encoder do `render.service`), então uma entrada `.png`
 *   sai como `.jpg`.
 */

/**
 * `p-limit` v7 é ESM-only; o Main do electron-vite externaliza com `require()` e entrega
 * `{ default: fn }` em vez da função. Sem este unwrap: `pLimit is not a function`.
 */
const pLimit =
  typeof pLimitImport === 'function'
    ? pLimitImport
    : (pLimitImport as unknown as { default: typeof pLimitImport }).default

/** Sufixo do modo `suffix` (REQUISITOS.md §9.2). */
const SUFFIX = '_geo'

/** Extensão da saída — o `render.service` grava JPEG. */
const OUTPUT_EXTENSION = '.jpg'

/**
 * Teto de imagens simultâneas.
 * - Windows (produto): até 4 — cada composição 36 MP ~150 MB; acima disso o ganho some (RNF-06).
 * - Linux/WSL (só dev): **1**. Sharp+Electron no Linux costuma SIGTRAP (signal 5) com várias
 *   composições em paralelo — o processo some e o `yarn dev` termina com "Done in …s".
 */
const MAX_CONCURRENCY = process.platform === 'win32' ? 4 : 1

interface RunningJob {
  canceled: boolean
}

/** Um lote por vez: dois lotes na mesma pasta de saída disputariam os mesmos arquivos. */
let running: RunningJob | null = null

/** Pede a interrupção do lote em andamento (o que já começou termina). */
export function cancelBatch(): void {
  if (running) running.canceled = true
}

/**
 * Roda o lote e devolve o resumo. `onProgress` é chamado ao começar e ao terminar cada foto —
 * o Renderer só desenha a barra, toda a contagem é feita aqui.
 */
export async function runBatch(
  rawConfig: unknown,
  onProgress: (progress: JobProgress) => void
): Promise<JobResult> {
  if (running) throw new Error('Já existe um lote em andamento')

  const config = parseConfig(rawConfig)
  const job: RunningJob = { canceled: false }
  running = job
  const started = process.hrtime.bigint()

  try {
    // caminhos vindos do Renderer passam pela mesma validação do import (ARQUITETURA.md §11)
    const { files, ignored } = await collectImagePaths(config.photos)
    if (files.length === 0) throw new Error('Nenhuma foto válida no lote')

    assertOutputIsSafe(config.outputDir, files)
    await mkdir(config.outputDir, { recursive: true })

    const issues: BatchIssue[] = ignored.map((item) => ({
      file: basename(item.filePath),
      reason: item.reason,
      skipped: true
    }))

    const counts = {
      total: files.length + ignored.length,
      processed: ignored.length,
      succeeded: 0,
      skipped: ignored.length,
      failed: 0
    }
    const report = (currentFile: string): void => onProgress({ ...counts, currentFile })

    // Planejar antes de gravar: assim duas fotos que gerariam o MESMO arquivo de saída são
    // detectadas de forma determinística, em vez de uma sobrescrever a outra por corrida.
    const plan: { filePath: string; outputPath: string }[] = []
    const taken = new Set<string>()

    for (const filePath of files) {
      const outputPath = outputPathFor(filePath, config)
      const key = outputPath.toLowerCase() // Windows não diferencia maiúsculas no nome

      if (taken.has(key)) {
        issues.push({
          file: basename(filePath),
          reason: `Outra foto do lote já gera "${basename(outputPath)}"`,
          skipped: true
        })
        counts.processed += 1
        counts.skipped += 1
        continue
      }

      taken.add(key)

      if (!config.overwrite && (await exists(outputPath))) {
        issues.push({
          file: basename(filePath),
          reason: 'Já existe na pasta de saída',
          skipped: true
        })
        counts.processed += 1
        counts.skipped += 1
        continue
      }

      plan.push({ filePath, outputPath })
    }

    report('')

    const limit = pLimit(Math.max(1, Math.min(cpus().length - 1, MAX_CONCURRENCY)))
    await Promise.all(
      plan.map((item) =>
        limit(async () => {
          if (job.canceled) return

          report(basename(item.filePath))
          const outcome = await processPhoto(item.filePath, item.outputPath, config.template)

          counts.processed += 1
          if (outcome === 'ok') {
            counts.succeeded += 1
          } else {
            counts[outcome.skipped ? 'skipped' : 'failed'] += 1
            issues.push({ file: basename(item.filePath), ...outcome })
          }
          report(basename(item.filePath))
        })
      )
    )

    return {
      total: counts.total,
      succeeded: counts.succeeded,
      skipped: counts.skipped,
      failed: counts.failed,
      outputDir: config.outputDir,
      canceled: job.canceled,
      elapsedMs: Number(process.hrtime.bigint() - started) / 1e6,
      issues
    }
  } finally {
    running = null
  }
}

/** Carimba uma foto. Nunca rejeita: o motivo vira linha do resumo (RNF-08). */
async function processPhoto(
  filePath: string,
  outputPath: string,
  template: Template
): Promise<'ok' | { reason: string; skipped: boolean }> {
  let photo: PhotoMetadata
  try {
    photo = await readPhotoMetadata(filePath)
  } catch (cause) {
    return { reason: messageOf(cause), skipped: false }
  }

  if (!hasContentToStamp(photo, template)) {
    return { reason: 'Sem telemetria e sem logo — nada a carimbar', skipped: true }
  }

  try {
    await renderPhotoToFile(photo, template, outputPath)
    return 'ok'
  } catch (cause) {
    return { reason: messageOf(cause), skipped: false }
  }
}

/**
 * Esta foto renderiza alguma coisa? Mesmo predicado do `overlay-svg` (campo sem valor não
 * entra no carimbo): sem nada para desenhar, a "cópia carimbada" seria só uma recompressão —
 * melhor contar como ignorada e dizer isso no resumo.
 */
function hasContentToStamp(photo: PhotoMetadata, template: Template): boolean {
  if (template.logos.length > 0) return true
  return template.section.fields.some(
    (item) =>
      !isDivider(item) && item.visible && Boolean(formatFieldValue(item.key, photo))
  )
}

/** `foto.jpg` → `<saída>/foto.jpg` ou `<saída>/foto_geo.jpg` (REQUISITOS.md §9.2). */
function outputPathFor(filePath: string, config: BatchConfig): string {
  const stem = basename(filePath, extname(filePath))
  const suffix = config.naming === 'suffix' ? SUFFIX : ''
  return join(config.outputDir, `${stem}${suffix}${OUTPUT_EXTENSION}`)
}

/**
 * Barreira que garante o RNF-03: gravando em pasta diferente da dos originais, nenhuma
 * combinação de nome/extensão consegue sobrescrever uma foto de entrada.
 */
function assertOutputIsSafe(outputDir: string, files: string[]): void {
  const sourceDirs = new Set(files.map((file) => dirname(file).toLowerCase()))
  if (sourceDirs.has(outputDir.toLowerCase())) {
    throw new Error(
      'A pasta de saída não pode ser a mesma das fotos originais — escolha outra pasta'
    )
  }
}

function parseConfig(raw: unknown): BatchConfig {
  if (!raw || typeof raw !== 'object') throw new Error('Configuração de lote inválida')
  const { photos, outputDir, template, naming, overwrite } = raw as Partial<BatchConfig>

  if (!Array.isArray(photos) || photos.length === 0) throw new Error('Nenhuma foto no lote')
  if (typeof outputDir !== 'string' || outputDir.trim() === '' || !isAbsolute(outputDir)) {
    throw new Error('Escolha a pasta de saída')
  }
  if (!template || typeof template !== 'object' || !template.section || !Array.isArray(template.logos)) {
    throw new Error('Template inválido')
  }

  return {
    photos: photos.filter((photo): photo is string => typeof photo === 'string'),
    outputDir: resolve(outputDir),
    template,
    naming: isNaming(naming) ? naming : 'keep',
    overwrite: overwrite === true
  }
}

function isNaming(value: unknown): value is OutputNaming {
  return value === 'keep' || value === 'suffix'
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
