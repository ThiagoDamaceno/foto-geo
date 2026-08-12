import { useCallback, useEffect, useState } from 'react'
import { clampQuality, DEFAULT_OUTPUT_QUALITY } from '@shared/output-quality'
import type { JobProgress, JobResult, OutputNaming, Template } from '@shared/types'
import { messageOf } from '../lib/ipc-error'

export interface BatchState {
  /** Pasta escolhida para as cópias; `null` = ainda não escolhida. */
  outputDir: string | null
  naming: OutputNaming
  overwrite: boolean
  /** Qualidade JPEG da saída (RF-11) — global, vale para todas as fotos. */
  quality: number
  isRunning: boolean
  /** Andamento vindo do Main (`batch:progress`). */
  progress: JobProgress | null
  /** Resumo do último lote (RF-09). */
  result: JobResult | null
  error: string | null
  setNaming: (naming: OutputNaming) => void
  setOverwrite: (overwrite: boolean) => void
  setQuality: (quality: number) => void
  pickOutputDir: () => Promise<void>
  start: (filePaths: string[]) => Promise<void>
  cancel: () => Promise<void>
  openOutput: () => Promise<void>
  dismiss: () => void
}

/**
 * Lote (RF-09). Quem conta sucessos/ignoradas/erros é o Main — aqui só chega o que desenhar,
 * então a tela nunca discorda do que foi realmente gravado.
 *
 * Como em todo estado do app: nenhuma exceção pode escapar. Sem console para o usuário
 * (RNF-10), um `throw` solto deixaria a janela em branco sem pista nenhuma.
 */
export function useBatch(template: Template): BatchState {
  const [outputDir, setOutputDir] = useState<string | null>(null)
  const [naming, setNaming] = useState<OutputNaming>('keep')
  const [overwrite, setOverwrite] = useState(false)
  const [quality, setQualityState] = useState(DEFAULT_OUTPUT_QUALITY)
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const [result, setResult] = useState<JobResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      return window.fotoGeo.onBatchProgress(setProgress)
    } catch {
      return undefined
    }
  }, [])

  const pickOutputDir = useCallback(async (): Promise<void> => {
    setError(null)
    try {
      const folder = await window.fotoGeo.pickOutputDir()
      if (folder) setOutputDir(folder)
    } catch (cause) {
      setError(messageOf(cause))
    }
  }, [])

  /** O clamp mora aqui e no Main: o slider pode vir de teclado/roda e passar do limite. */
  const setQuality = useCallback((next: number): void => {
    setQualityState(clampQuality(next))
  }, [])

  const start = useCallback(
    async (filePaths: string[]): Promise<void> => {
      if (!outputDir || filePaths.length === 0) return

      setIsRunning(true)
      setError(null)
      setResult(null)
      setProgress(null)
      try {
        setResult(
          await window.fotoGeo.startBatch({
            photos: filePaths,
            outputDir,
            template,
            naming,
            overwrite,
            quality
          })
        )
      } catch (cause) {
        setError(messageOf(cause))
      } finally {
        setIsRunning(false)
        setProgress(null)
      }
    },
    [naming, outputDir, overwrite, quality, template]
  )

  const cancel = useCallback(async (): Promise<void> => {
    try {
      await window.fotoGeo.cancelBatch()
    } catch (cause) {
      setError(messageOf(cause))
    }
  }, [])

  const openOutput = useCallback(async (): Promise<void> => {
    const folder = result?.outputDir ?? outputDir
    if (!folder) return

    try {
      await window.fotoGeo.openPath(folder)
    } catch (cause) {
      setError(messageOf(cause))
    }
  }, [outputDir, result])

  const dismiss = useCallback((): void => {
    setError(null)
    setResult(null)
  }, [])

  return {
    outputDir,
    naming,
    overwrite,
    quality,
    isRunning,
    progress,
    result,
    error,
    setNaming,
    setOverwrite,
    setQuality,
    pickOutputDir,
    start,
    cancel,
    openOutput,
    dismiss
  }
}
