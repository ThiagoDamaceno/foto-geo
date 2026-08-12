import { useEffect, useRef, useState } from 'react'
import type { OutputSizeEstimate, PhotoMetadata, Template } from '@shared/types'
import { messageOf } from '../lib/ipc-error'

/**
 * Tamanho do arquivo que a foto **selecionada** vai gerar na qualidade atual (RF-11).
 *
 * Trocar de foto ou mexer no slider remede; o número vem do render de verdade no Main,
 * então cada medida custa um carimbo inteiro — daí o debounce e o cache.
 */
export interface OutputSizeState {
  /** Medida da foto atual; `null` enquanto não há valor para ela. */
  estimate: OutputSizeEstimate | null
  isEstimating: boolean
  error: string | null
}

/** Tempo parado antes de medir — arrastar o slider não dispara um render por pixel. */
const DEBOUNCE_MS = 500

export function useOutputSize(
  photo: PhotoMetadata | null,
  template: Template,
  quality: number,
  /** `false` durante o lote: a CPU é toda dele. */
  enabled: boolean
): OutputSizeState {
  const [estimate, setEstimate] = useState<OutputSizeEstimate | null>(null)
  const [isEstimating, setIsEstimating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cache = useRef(new Map<string, OutputSizeEstimate>())
  // template e foto entram por ref: só filePath/qualidade devem disparar uma nova medida —
  // arrastar a seção no canvas não pode render a foto inteira a cada frame
  const templateRef = useRef(template)
  templateRef.current = template
  const photoRef = useRef(photo)
  photoRef.current = photo

  // o carimbo mudou: as medidas guardadas envelheceram (o overlay entra no arquivo).
  // O valor na tela continua como última referência — por isso o "≈" na interface.
  useEffect(() => {
    cache.current.clear()
  }, [template])

  const filePath = photo?.filePath ?? null

  useEffect(() => {
    if (!filePath || !enabled) {
      setIsEstimating(false)
      return
    }

    const key = `${filePath}|${quality}`
    const cached = cache.current.get(key)
    if (cached) {
      setEstimate(cached)
      setError(null)
      setIsEstimating(false)
      return
    }

    // sem número velho na tela: ele seria de outra foto/qualidade
    setEstimate(null)
    setError(null)
    setIsEstimating(true)

    let active = true
    const timer = window.setTimeout(() => {
      void (async () => {
        const target = photoRef.current
        if (!target || target.filePath !== filePath) return

        try {
          const result = await window.fotoGeo.estimateOutputSize(
            target,
            templateRef.current,
            quality
          )
          if (!active) return
          cache.current.set(key, result)
          setEstimate(result)
        } catch (cause) {
          if (active) setError(messageOf(cause))
        } finally {
          if (active) setIsEstimating(false)
        }
      })()
    }, DEBOUNCE_MS)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [filePath, quality, enabled])

  return { estimate, isEstimating, error }
}
