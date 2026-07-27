import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import type { LogoAsset, LogoConfig } from '@shared/types'

/**
 * Lista de logos: **arrastar reordena o empilhamento** — o item de cima fica por cima na foto.
 * Cada linha tem largura e opacidade próprias.
 */
export default function LogoList({
  logos,
  assets,
  photoWidth,
  onReorder,
  onPatch,
  onRemove
}: {
  logos: LogoConfig[]
  assets: Record<string, LogoAsset>
  photoWidth: number
  onReorder: (from: number, to: number) => void
  onPatch: (id: string, patch: Partial<Omit<LogoConfig, 'id' | 'filePath'>>) => void
  onRemove: (id: string) => void
}): React.JSX.Element {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const from = logos.findIndex((logo) => logo.id === active.id)
    const to = logos.findIndex((logo) => logo.id === over.id)
    if (from !== -1 && to !== -1) onReorder(from, to)
  }

  if (logos.length === 0) {
    return (
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Nenhuma logo. Adicione PNG, SVG, WebP…
      </p>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={logos.map((logo) => logo.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {logos.map((logo, index) => (
            <LogoRow
              key={logo.id}
              logo={logo}
              asset={assets[logo.id]}
              stackHint={index === 0 ? 'frente' : undefined}
              photoWidth={photoWidth}
              onPatch={onPatch}
              onRemove={onRemove}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function LogoRow({
  logo,
  asset,
  stackHint,
  photoWidth,
  onPatch,
  onRemove
}: {
  logo: LogoConfig
  asset: LogoAsset | undefined
  stackHint?: string
  photoWidth: number
  onPatch: (id: string, patch: Partial<Omit<LogoConfig, 'id' | 'filePath'>>) => void
  onRemove: (id: string) => void
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: logo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`space-y-2 rounded-lg border px-2 py-2 text-xs ${
        isDragging
          ? 'z-10 border-sky-400 bg-sky-500/10 shadow-lg'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/40'
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          title="Arrastar para mudar quem fica por cima"
          className="cursor-grab text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>

        {asset ? (
          <img
            src={asset.dataUrl}
            alt=""
            className="h-8 w-12 shrink-0 border border-slate-200 bg-slate-100 object-contain p-0.5 dark:border-slate-700 dark:bg-slate-800"
          />
        ) : (
          <div className="flex h-8 w-12 shrink-0 items-center justify-center border border-dashed border-slate-300 text-[9px] text-slate-400 dark:border-slate-600">
            ?
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-700 dark:text-slate-200" title={logo.filePath}>
            {fileNameOf(logo.filePath)}
          </p>
          {stackHint && (
            <p className="text-[10px] text-sky-600 dark:text-sky-400">Por cima na foto</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onRemove(logo.id)}
          title="Remover logo"
          className="rounded p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </button>
      </div>

      <label className="block space-y-1">
        <span className="flex items-baseline justify-between text-[11px] text-slate-600 dark:text-slate-300">
          Largura
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
            {Math.round(logo.widthPct * photoWidth)} px
          </span>
        </span>
        <input
          type="range"
          min={0.02}
          max={0.6}
          step={0.005}
          value={logo.widthPct}
          onChange={(event) => onPatch(logo.id, { widthPct: Number(event.target.value) })}
          className="w-full accent-sky-600"
        />
      </label>

      <label className="block space-y-1">
        <span className="flex items-baseline justify-between text-[11px] text-slate-600 dark:text-slate-300">
          Opacidade
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
            {Math.round(logo.opacity * 100)}%
          </span>
        </span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={logo.opacity}
          onChange={(event) => onPatch(logo.id, { opacity: Number(event.target.value) })}
          className="w-full accent-sky-600"
        />
      </label>
    </li>
  )
}

function fileNameOf(filePath: string): string {
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || filePath
}
