import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image as ImageIcon, Loader2, Move, RotateCcw, Timer } from 'lucide-react'
import { buildOverlaySvg, svgToDataUri } from '@shared/overlay-svg'
import type { PhotoMetadata, PreviewImage, RenderedPreview, Template } from '@shared/types'
import { ICON_MARKUP } from '../lib/icon-markup'

type Mode = 'preview' | 'sharp'

/**
 * Preview do carimbo sobre a foto real (RF-08).
 *
 * O overlay é **o mesmo SVG** que o Sharp compõe na saída — gerado em `shared/overlay-svg.ts`
 * no tamanho real da foto e só escalado pelo navegador. É o que garante preview = arquivo
 * (RNF-05); o botão "Render (Sharp)" existe para conferir isso a qualquer momento.
 */
export default function EditorCanvas({
  photo,
  template,
  onMoveSection,
  onResizeSection,
  onResetTemplate
}: {
  photo: PhotoMetadata
  template: Template
  onMoveSection: (x: number, y: number) => void
  onResizeSection: (widthPct: number) => void
  onResetTemplate: () => void
}): React.JSX.Element {
  const [preview, setPreview] = useState<PreviewImage | null>(null)
  const [rendered, setRendered] = useState<RenderedPreview | null>(null)
  const [mode, setMode] = useState<Mode>('preview')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    setPreview(null)
    setRendered(null)
    setMode('preview')
    setError(null)
    setIsBusy(true)

    void (async () => {
      try {
        const image = await window.fotoGeo.getPreviewImage(photo.filePath, 1400)
        if (active) setPreview(image)
      } catch (cause) {
        if (active) setError(messageOf(cause))
      } finally {
        if (active) setIsBusy(false)
      }
    })()

    return () => {
      active = false
    }
  }, [photo.filePath])

  // o carimbo é gerado no tamanho REAL da foto; o navegador só escala o SVG
  const overlay = useMemo(() => {
    const size = { width: photo.width, height: photo.height }
    if (size.width === 0 || size.height === 0) return null
    return buildOverlaySvg({ size, template, photo, icons: ICON_MARKUP })
  }, [photo, template])

  const runSharpRender = useCallback(async (): Promise<void> => {
    setIsBusy(true)
    setError(null)
    try {
      const result = await window.fotoGeo.renderPreview(photo, template, 1400)
      setRendered(result)
      setMode('sharp')
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setIsBusy(false)
    }
  }, [photo, template])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, kind: 'move' | 'resize'): void => {
      const frame = frameRef.current
      if (!frame) return

      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)

      const rect = frame.getBoundingClientRect()
      const startX = event.clientX
      const startY = event.clientY
      const origin = { x: template.section.x, y: template.section.y }
      const originWidth = template.section.widthPct

      const onMove = (moveEvent: PointerEvent): void => {
        const dx = (moveEvent.clientX - startX) / rect.width
        const dy = (moveEvent.clientY - startY) / rect.height

        if (kind === 'move') {
          onMoveSection(origin.x + dx, origin.y + dy)
        } else {
          onResizeSection(originWidth + dx)
        }
      }

      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [onMoveSection, onResizeSection, template.section]
  )

  const image = mode === 'sharp' ? rendered : preview
  const handleBox =
    overlay && photo.width > 0
      ? {
          left: `${(overlay.sectionBox.x / photo.width) * 100}%`,
          top: `${(overlay.sectionBox.y / photo.height) * 100}%`,
          width: `${(overlay.sectionBox.width / photo.width) * 100}%`,
          height: `${(overlay.sectionBox.height / photo.height) * 100}%`
        }
      : null

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
            {photo.fileName}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {photo.width} × {photo.height} · seção em {(template.section.x * 100).toFixed(1)}% ,{' '}
            {(template.section.y * 100).toFixed(1)}% · largura{' '}
            {(template.section.widthPct * 100).toFixed(1)}%
          </p>
        </div>

        <div className="flex items-center gap-2">
          {rendered && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Timer className="size-3.5" aria-hidden />
              {rendered.elapsedMs.toFixed(0)} ms
            </span>
          )}
          <div className="flex overflow-hidden rounded-lg border border-slate-300 text-xs dark:border-slate-700">
            <button
              type="button"
              onClick={() => setMode('preview')}
              className={`px-3 py-1.5 font-medium ${
                mode === 'preview'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => void runSharpRender()}
              disabled={isBusy}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-medium disabled:opacity-50 ${
                mode === 'sharp'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
              title="Carimba em tamanho real com o Sharp para conferir a fidelidade"
            >
              {isBusy ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <ImageIcon className="size-3.5" aria-hidden />
              )}
              Render (Sharp)
            </button>
          </div>
          <button
            type="button"
            onClick={onResetTemplate}
            title="Voltar ao perfil padrão"
            className="rounded-lg border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <RotateCcw className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {/* A própria foto define a caixa (`w-fit`): assim overlay e alças ficam sempre
          exatamente sobre a imagem, sem faixa preta para desalinhar as porcentagens. */}
      <div className="flex justify-center">
        {image ? (
          <div ref={frameRef} className="relative w-fit overflow-hidden rounded-lg">
            <img
              src={image.dataUrl}
              alt=""
              className="block max-h-[60vh] w-auto max-w-full select-none"
              draggable={false}
            />

            {/* No modo Sharp a imagem JÁ tem o carimbo — nada de sobrepor de novo. */}
            {mode === 'preview' && overlay && (
              <img
                src={svgToDataUri(overlay.svg)}
                alt=""
                className="pointer-events-none absolute inset-0 size-full"
                draggable={false}
              />
            )}

            {mode === 'preview' && handleBox && (
              <div
                onPointerDown={(event) => handlePointerDown(event, 'move')}
                style={handleBox}
                className="absolute cursor-move rounded-sm border border-dashed border-sky-400/70 hover:bg-sky-400/10"
              >
                <Move className="absolute -top-5 left-0 size-4 text-sky-400 drop-shadow" aria-hidden />
                <div
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    handlePointerDown(event, 'resize')
                  }}
                  className="absolute -right-1.5 -bottom-1.5 size-3 cursor-ew-resize rounded-full border border-white bg-sky-500"
                  title="Arrastar para mudar a largura da seção"
                />
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex max-h-[60vh] w-full items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800"
            style={{ aspectRatio: `${photo.width || 16} / ${photo.height || 9}` }}
          >
            <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Arraste a área tracejada para mover a seção e a bolinha para mudar a largura. Posições são
        relativas à imagem, então o mesmo perfil serve para qualquer resolução (RNF-04).
      </p>
    </section>
  )
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
