import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eye, Loader2, Move, Pencil, Timer } from 'lucide-react'
import { logoBox, type Box } from '@shared/geometry'
import { buildOverlaySvg, svgToDataUri } from '@shared/overlay-svg'
import type { LogoAsset, PhotoMetadata, PreviewImage, RenderedPreview, Template } from '@shared/types'
import { ICON_MARKUP } from '../lib/icon-markup'

/** `edit` = overlay + alças · `view` = foto já carimbada (saída real). */
type Mode = 'edit' | 'view'
type Selection = { kind: 'section' } | { kind: 'logo'; id: string }
type Handle =
  | { kind: 'section-move' }
  | { kind: 'section-resize' }
  | { kind: 'logo-move'; id: string }
  | { kind: 'logo-resize'; id: string }

/**
 * Preview do carimbo sobre a foto real (RF-08).
 *
 * O overlay é **o mesmo SVG** da saída — gerado em `shared/overlay-svg.ts` no tamanho real
 * da foto e só escalado pelo navegador (RNF-05). "Visualizar" carimba de verdade para
 * conferir; "Editar" volta às alças sem precisar mexer no inspector.
 */
export default function EditorCanvas({
  photo,
  template,
  logoAssets,
  onMoveSection,
  onResizeSection,
  onMoveLogo,
  onResizeLogo,
  onRemoveLogo
}: {
  photo: PhotoMetadata
  template: Template
  logoAssets: Record<string, LogoAsset>
  onMoveSection: (x: number, y: number) => void
  onResizeSection: (widthPct: number) => void
  onMoveLogo: (id: string, x: number, y: number) => void
  onResizeLogo: (id: string, widthPct: number) => void
  onRemoveLogo: (id: string) => void
}): React.JSX.Element {
  const [preview, setPreview] = useState<PreviewImage | null>(null)
  const [rendered, setRendered] = useState<RenderedPreview | null>(null)
  const [mode, setMode] = useState<Mode>('edit')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  const overlayLogos = useMemo(
    () =>
      template.logos.flatMap((logo) => {
        const asset = logoAssets[logo.id]
        return asset
          ? [{ id: logo.id, dataUrl: asset.dataUrl, aspectRatio: asset.aspectRatio }]
          : []
      }),
    [template.logos, logoAssets]
  )

  useEffect(() => {
    let active = true
    setPreview(null)
    setRendered(null)
    setMode('edit')
    setError(null)
    setSelection(null)
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

  // mudança no template invalida a visualização já gerada
  useEffect(() => {
    setRendered(null)
    setMode('edit')
  }, [template])

  // logo removida (inspector ou Del) — limpa seleção órfã
  useEffect(() => {
    if (selection?.kind !== 'logo') return
    if (!template.logos.some((logo) => logo.id === selection.id)) {
      setSelection(null)
    }
  }, [template.logos, selection])

  // o carimbo é gerado no tamanho REAL da foto; o navegador só escala o SVG
  const overlay = useMemo(() => {
    const size = { width: photo.width, height: photo.height }
    if (size.width === 0 || size.height === 0) return null

    return buildOverlaySvg({
      size,
      template,
      photo,
      icons: ICON_MARKUP,
      logos: overlayLogos
    })
  }, [photo, template, overlayLogos])

  const showView = useCallback(async (): Promise<void> => {
    setIsBusy(true)
    setError(null)
    setSelection(null)
    try {
      const result = await window.fotoGeo.renderPreview(photo, template, 1400)
      setRendered(result)
      setMode('view')
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setIsBusy(false)
    }
  }, [photo, template])

  const showEdit = useCallback((): void => {
    setMode('edit')
  }, [])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, handle: Handle): void => {
      const frame = frameRef.current
      if (!frame) return

      event.preventDefault()
      event.stopPropagation()

      if (handle.kind === 'section-move' || handle.kind === 'section-resize') {
        setSelection({ kind: 'section' })
      } else {
        setSelection({ kind: 'logo', id: handle.id })
      }

      const rect = frame.getBoundingClientRect()
      const startX = event.clientX
      const startY = event.clientY

      const logo =
        handle.kind === 'logo-move' || handle.kind === 'logo-resize'
          ? template.logos.find((item) => item.id === handle.id)
          : null

      const origin = logo ?? { x: template.section.x, y: template.section.y }
      const originWidth = logo?.widthPct ?? template.section.widthPct

      const onMove = (moveEvent: PointerEvent): void => {
        const dx = (moveEvent.clientX - startX) / rect.width
        const dy = (moveEvent.clientY - startY) / rect.height

        switch (handle.kind) {
          case 'section-move':
            return onMoveSection(origin.x + dx, origin.y + dy)
          case 'section-resize':
            return onResizeSection(originWidth + dx)
          case 'logo-move':
            return onMoveLogo(handle.id, origin.x + dx, origin.y + dy)
          case 'logo-resize':
            return onResizeLogo(handle.id, originWidth + dx)
        }
      }

      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [onMoveSection, onResizeSection, onMoveLogo, onResizeLogo, template.logos, template.section]
  )

  // setas = 1 px na foto; Shift+seta = 10 px · Del/Backspace remove logo selecionada
  useEffect(() => {
    if (mode !== 'edit' || !selection || photo.width <= 0 || photo.height <= 0) return

    const onKeyDown = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target)) return

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selection.kind !== 'logo') return
        event.preventDefault()
        onRemoveLogo(selection.id)
        setSelection(null)
        return
      }

      const step = (event.shiftKey ? 10 : 1) / photo.width
      const stepY = (event.shiftKey ? 10 : 1) / photo.height
      let dx = 0
      let dy = 0

      switch (event.key) {
        case 'ArrowLeft':
          dx = -step
          break
        case 'ArrowRight':
          dx = step
          break
        case 'ArrowUp':
          dy = -stepY
          break
        case 'ArrowDown':
          dy = stepY
          break
        case 'Escape':
          setSelection(null)
          return
        default:
          return
      }

      event.preventDefault()

      if (selection.kind === 'section') {
        onMoveSection(template.section.x + dx, template.section.y + dy)
        return
      }

      const logo = template.logos.find((item) => item.id === selection.id)
      if (logo) onMoveLogo(logo.id, logo.x + dx, logo.y + dy)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    mode,
    selection,
    photo.width,
    photo.height,
    template.section.x,
    template.section.y,
    template.logos,
    onMoveSection,
    onMoveLogo,
    onRemoveLogo
  ])

  const image = mode === 'view' ? rendered : preview
  const size = { width: photo.width, height: photo.height }
  const sectionStyle = overlay && photo.width > 0 ? toPercent(overlay.sectionBox, size) : null

  // alças: fundo → frente, para o item de cima da lista receber o clique
  const logoHandles = [...template.logos]
    .reverse()
    .flatMap((logo) => {
      const asset = logoAssets[logo.id]
      if (!asset || photo.width === 0) return []
      return [
        {
          id: logo.id,
          style: toPercent(logoBox(logo, size, asset.aspectRatio), size)
        }
      ]
    })

  return (
    <section className="min-w-0 shrink-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
            {photo.fileName}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {photo.width} × {photo.height} · seção em {(template.section.x * 100).toFixed(1)}% ,{' '}
            {(template.section.y * 100).toFixed(1)}%
            {overlay
              ? ` · ${overlay.rows.filter((row) => row !== 'divider').length} campo(s) no carimbo`
              : ''}
            {template.logos.length > 0 ? ` · ${template.logos.length} logo(s)` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'view' && rendered && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Timer className="size-3.5" aria-hidden />
              {rendered.elapsedMs.toFixed(0)} ms
            </span>
          )}
          <button
            type="button"
            onClick={() => void showView()}
            disabled={isBusy || mode === 'view'}
            title="Gera a saída real e mostra o resultado (sem alças de edição)"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isBusy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Eye className="size-3.5" aria-hidden />
            )}
            Visualizar
          </button>
          <button
            type="button"
            onClick={showEdit}
            disabled={isBusy || mode === 'edit'}
            title="Volta ao modo edição — overlay e alças para posicionar o carimbo"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Pencil className="size-3.5" aria-hidden />
            Editar
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
          <div
            ref={frameRef}
            className="relative w-fit overflow-hidden"
            onPointerDown={() => setSelection(null)}
          >
            <img
              src={image.dataUrl}
              alt=""
              className="block max-h-[58vh] w-auto max-w-full select-none"
              draggable={false}
            />

            {/* No modo visualização a imagem JÁ tem o carimbo — nada de sobrepor de novo. */}
            {mode === 'edit' && overlay && (
              <img
                src={svgToDataUri(overlay.svg)}
                alt=""
                className="pointer-events-none absolute inset-0 size-full"
                draggable={false}
              />
            )}

            {mode === 'edit' && sectionStyle && (
              <DragBox
                style={sectionStyle}
                label="Seção de dados"
                selected={selection?.kind === 'section'}
                onMove={(event) => handlePointerDown(event, { kind: 'section-move' })}
                onResize={(event) => handlePointerDown(event, { kind: 'section-resize' })}
              />
            )}

            {mode === 'edit' &&
              logoHandles.map((handle) => (
                <DragBox
                  key={handle.id}
                  style={handle.style}
                  label="Logo"
                  selected={selection?.kind === 'logo' && selection.id === handle.id}
                  onMove={(event) => handlePointerDown(event, { kind: 'logo-move', id: handle.id })}
                  onResize={(event) =>
                    handlePointerDown(event, { kind: 'logo-resize', id: handle.id })
                  }
                />
              ))}
          </div>
        ) : (
          <div
            className="flex max-h-[58vh] w-full items-center justify-center bg-slate-200 dark:bg-slate-800"
            style={{ aspectRatio: `${photo.width || 16} / ${photo.height || 9}` }}
          >
            <Loader2 className="size-6 animate-spin text-slate-400" aria-hidden />
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Clique para selecionar · setas movem 1 px (Shift+seta = 10 px) · Del remove a logo · arraste
        para posicionar e a bolinha para a largura.
      </p>
    </section>
  )
}

/** Alça transparente sobre o SVG: move (arrastando a área) e redimensiona (bolinha). */
function DragBox({
  style,
  label,
  selected,
  onMove,
  onResize
}: {
  style: React.CSSProperties
  label: string
  selected: boolean
  onMove: (event: React.PointerEvent<HTMLDivElement>) => void
  onResize: (event: React.PointerEvent<HTMLDivElement>) => void
}): React.JSX.Element {
  return (
    <div
      onPointerDown={onMove}
      style={style}
      title={`${label} — arraste ou use as setas`}
      className={`absolute cursor-move rounded-sm border border-dashed hover:bg-sky-400/10 ${
        selected
          ? 'border-sky-500 bg-sky-400/15 ring-1 ring-sky-500'
          : 'border-sky-400/70'
      }`}
    >
      <Move
        className={`absolute -top-5 left-0 size-4 drop-shadow ${
          selected ? 'text-sky-500' : 'text-sky-400'
        }`}
        aria-hidden
      />
      <div
        onPointerDown={onResize}
        title={`${label} — arraste para mudar a largura`}
        className="absolute -right-1.5 -bottom-1.5 size-3 cursor-ew-resize rounded-full border border-white bg-sky-500"
      />
    </div>
  )
}

function toPercent(box: Box, size: { width: number; height: number }): React.CSSProperties {
  return {
    left: `${(box.x / size.width) * 100}%`,
    top: `${(box.y / size.height) * 100}%`,
    width: `${(box.width / size.width) * 100}%`,
    height: `${(box.height / size.height) * 100}%`
  }
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
