import {
  CircleCheck,
  FileDown,
  FolderOpen,
  Layers,
  Loader2,
  Play,
  Square,
  TriangleAlert,
  X
} from 'lucide-react'
import ProgressBar from './ProgressBar'
import { formatFileSize, formatNumberBr } from '@shared/format'
import { MAX_OUTPUT_QUALITY, MIN_OUTPUT_QUALITY } from '@shared/output-quality'
import type { JobProgress, JobResult, OutputNaming } from '@shared/types'

/**
 * Tamanhos da foto em foco no editor (RF-11): o original e o que a compressão atual
 * produz. Trocar de foto na lista troca estes números.
 */
export interface OutputSizePreview {
  fileName: string
  originalBytes: number
  /** `null` enquanto a medida não chegou. */
  outputBytes: number | null
  isEstimating: boolean
  error: string | null
}

/**
 * Aplicação em lote (RF-09): pasta de saída, nome dos arquivos, progresso e resumo.
 *
 * A contagem toda vem do Main — esta tela não soma nada por conta própria, senão o resumo
 * poderia discordar do que foi realmente gravado.
 */
export default function BatchPanel({
  photoCount,
  sampleName,
  outputDir,
  naming,
  overwrite,
  quality,
  sizePreview,
  isRunning,
  progress,
  result,
  error,
  onPickOutputDir,
  onNaming,
  onOverwrite,
  onQuality,
  onStart,
  onCancel,
  onOpenOutput,
  onDismiss
}: {
  photoCount: number
  /** Nome de uma foto do lote, para mostrar como o arquivo vai sair. */
  sampleName: string | null
  outputDir: string | null
  naming: OutputNaming
  overwrite: boolean
  /** Qualidade JPEG da saída — uma só para o lote inteiro (RF-11). */
  quality: number
  /** Tamanhos da foto em foco; `null` quando nenhuma está selecionada. */
  sizePreview: OutputSizePreview | null
  isRunning: boolean
  progress: JobProgress | null
  result: JobResult | null
  error: string | null
  onPickOutputDir: () => void
  onNaming: (naming: OutputNaming) => void
  onOverwrite: (overwrite: boolean) => void
  onQuality: (quality: number) => void
  onStart: () => void
  onCancel: () => void
  onOpenOutput: () => void
  onDismiss: () => void
}): React.JSX.Element {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center gap-2">
        <Layers className="size-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
        <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          Aplicar em lote
        </h2>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          {photoCount} foto{photoCount > 1 ? 's' : ''} · os originais não são alterados
        </span>

        <div className="ml-auto flex items-center gap-2">
          {isRunning ? (
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1.5 rounded-lg border border-red-300 px-2.5 py-1.5 text-[11px] font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              <Square className="size-3.5" aria-hidden />
              Parar
            </button>
          ) : (
            <button
              type="button"
              onClick={onStart}
              disabled={!outputDir || photoCount === 0}
              title={outputDir ? 'Carimbar todas as fotos do lote' : 'Escolha a pasta de saída'}
              className="flex items-center gap-1.5 rounded-lg border border-sky-600 bg-sky-600 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-sky-500 disabled:opacity-40 dark:border-sky-500 dark:bg-sky-600"
            >
              <Play className="size-3.5" aria-hidden />
              Processar {photoCount} foto{photoCount > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onPickOutputDir}
          disabled={isRunning}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <FolderOpen className="size-3.5" aria-hidden />
          Pasta de saída…
        </button>
        <span
          className="min-w-0 flex-1 truncate text-[11px] text-slate-500 dark:text-slate-400"
          title={outputDir ?? undefined}
        >
          {outputDir ?? 'nenhuma pasta escolhida — precisa ser diferente da pasta das fotos'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="text-[11px] text-slate-500 dark:text-slate-400" htmlFor="batch-naming">
          Nome dos arquivos
        </label>
        <select
          id="batch-naming"
          value={naming}
          disabled={isRunning}
          onChange={(event) => onNaming(event.target.value as OutputNaming)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="keep">Manter o nome original</option>
          <option value="suffix">Acrescentar _geo</option>
        </select>
        {sampleName && (
          <span className="min-w-0 truncate text-[11px] text-slate-400 dark:text-slate-500">
            ex.: {outputName(sampleName, naming)}
          </span>
        )}

        <label className="ml-auto inline-flex items-center gap-2 text-[11px] leading-none text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            checked={overwrite}
            disabled={isRunning}
            onChange={(event) => onOverwrite(event.target.checked)}
            className="size-3.5 shrink-0 accent-sky-600"
          />
          <span>Sobrescrever o que já existir na saída</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label
          className="text-[11px] text-slate-500 dark:text-slate-400"
          htmlFor="batch-quality"
          title="Qualidade do JPEG gerado pelo Sharp. Menor = arquivo menor e mais perda; 98 fica quase igual ao original."
        >
          Compressão
        </label>
        <input
          id="batch-quality"
          type="range"
          min={MIN_OUTPUT_QUALITY}
          max={MAX_OUTPUT_QUALITY}
          step={1}
          value={quality}
          disabled={isRunning}
          onChange={(event) => onQuality(Number(event.target.value))}
          title="Vale para todas as fotos do lote"
          className="h-1.5 w-40 cursor-pointer accent-sky-600 disabled:opacity-40"
        />
        <span className="w-16 shrink-0 font-mono text-[11px] text-slate-600 dark:text-slate-300">
          {quality}% <span className="text-slate-400 dark:text-slate-500">JPEG</span>
        </span>

        {sizePreview && <SizeHint preview={sizePreview} />}
      </div>

      {isRunning && progress && (
        <div className="space-y-1.5">
          <ProgressBar value={progress.total === 0 ? 0 : progress.processed / progress.total} label="Progresso do lote" />
          <p className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <strong className="font-semibold text-slate-700 dark:text-slate-200">
              {progress.processed}/{progress.total}
            </strong>
            {progress.currentFile && <span className="truncate">{progress.currentFile}</span>}
            <span className="ml-auto">
              {progress.succeeded} ok · {progress.skipped} ignorada
              {progress.skipped === 1 ? '' : 's'} · {progress.failed} com erro
            </span>
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <p className="flex-1">Lote: {error}</p>
          <Dismiss onDismiss={onDismiss} />
        </div>
      )}

      {result && !isRunning && <Summary result={result} onOpen={onOpenOutput} onDismiss={onDismiss} />}
    </section>
  )
}

/**
 * `IMG_0253.JPG · 24,6 MB → ≈ 18,2 MB (−26%)` para a foto em foco (RF-11).
 *
 * O "≈" é honesto: a medida é o render real desta foto, mas fica valendo enquanto o
 * carimbo é editado — só a próxima troca de foto/compressão remede.
 */
function SizeHint({ preview }: { preview: OutputSizePreview }): React.JSX.Element {
  const { fileName, originalBytes, outputBytes, isEstimating, error } = preview

  return (
    <span
      className="ml-auto flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
      title={`Tamanho da cópia de ${fileName} com a compressão atual`}
    >
      <FileDown className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 max-w-40 truncate">{fileName}</span>
      <span className="font-mono">{formatFileSize(originalBytes)}</span>
      <span aria-hidden>→</span>

      {error ? (
        <span className="text-amber-700 dark:text-amber-400">medida indisponível</span>
      ) : isEstimating || outputBytes === null ? (
        <span className="flex items-center gap-1">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          calculando…
        </span>
      ) : (
        <>
          <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">
            ≈ {formatFileSize(outputBytes)}
          </span>
          <span className={deltaTone(originalBytes, outputBytes)}>
            ({formatDelta(originalBytes, outputBytes)})
          </span>
        </>
      )}
    </span>
  )
}

/** `−26%` (menor que o original) ou `+4%` (recompressão que engordou o arquivo). */
function formatDelta(originalBytes: number, outputBytes: number): string {
  if (originalBytes <= 0) return '—'
  const percent = ((outputBytes - originalBytes) / originalBytes) * 100
  const rounded = Math.abs(percent) < 0.05 ? 0 : percent
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${formatNumberBr(Math.abs(rounded), 0)}%`
}

function deltaTone(originalBytes: number, outputBytes: number): string {
  if (outputBytes > originalBytes) return 'text-amber-700 dark:text-amber-400'
  return 'text-emerald-700 dark:text-emerald-400'
}

/** Resumo do lote (RF-09): contagem, o que não saiu e o atalho para a pasta. */
function Summary({
  result,
  onOpen,
  onDismiss
}: {
  result: JobResult
  onOpen: () => void
  onDismiss: () => void
}): React.JSX.Element {
  const tone = result.failed > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'
  const Icon = result.failed > 0 ? TriangleAlert : CircleCheck
  const iconColor = result.failed > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'

  return (
    <div className={`space-y-2 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-200 ${tone}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 size-4 shrink-0 ${iconColor}`} aria-hidden />
        <div className="flex-1 space-y-0.5">
          <p className="font-medium">
            {result.canceled ? 'Lote interrompido' : 'Lote concluído'} — {result.succeeded} de{' '}
            {result.total} carimbada{result.succeeded === 1 ? '' : 's'} em{' '}
            {formatElapsed(result.elapsedMs)}
            {result.skipped > 0 && ` · ${result.skipped} ignorada${result.skipped === 1 ? '' : 's'}`}
            {result.failed > 0 && ` · ${result.failed} com erro`}
          </p>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400" title={result.outputDir}>
            {result.outputDir}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white/60 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <FolderOpen className="size-3.5" aria-hidden />
          Abrir pasta
        </button>
        <Dismiss onDismiss={onDismiss} />
      </div>

      {result.issues.length > 0 && (
        <ul className="max-h-32 space-y-0.5 overflow-y-auto text-[11px]">
          {result.issues.map((issue) => (
            <li key={`${issue.file}-${issue.reason}`} className="flex gap-2">
              <span
                className={`shrink-0 font-medium ${issue.skipped ? 'text-slate-500 dark:text-slate-400' : 'text-red-700 dark:text-red-300'}`}
              >
                {issue.skipped ? 'ignorada' : 'erro'}
              </span>
              <span className="truncate" title={issue.file}>
                {issue.file}
              </span>
              <span className="min-w-0 flex-1 truncate opacity-75">— {issue.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Dismiss({ onDismiss }: { onDismiss: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onDismiss}
      title="Fechar"
      className="shrink-0 opacity-70 hover:opacity-100"
    >
      <X className="size-3.5" aria-hidden />
    </button>
  )
}

/** Mostra como o arquivo sai — a saída é sempre JPEG (ARQUITETURA.md §10). */
function outputName(fileName: string, naming: OutputNaming): string {
  const stem = fileName.replace(/\.[^.]+$/, '')
  return `${stem}${naming === 'suffix' ? '_geo' : ''}.jpg`
}

/** `8,4 s` / `2 min 13 s` (RNF-07). */
function formatElapsed(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1).replace('.', ',')} s`

  const minutes = Math.floor(seconds / 60)
  return `${minutes} min ${Math.round(seconds - minutes * 60)} s`
}
