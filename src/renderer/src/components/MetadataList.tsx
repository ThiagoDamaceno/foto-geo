import { AlertTriangle, Images, Trash2 } from 'lucide-react'
import { FIELD_LABEL, FIELD_ORDER } from '@shared/field-icons'
import { formatFieldValue, formatFileSize } from '@shared/format'
import type { PhotoMetadata } from '@shared/types'
import { fieldIcon } from '../lib/field-icons'

/** Sidebar esquerda: fotos do lote e cobertura dos campos (RF-02). */
export default function MetadataList({
  photos,
  selectedPath,
  onSelect,
  onRemove,
  onClear
}: {
  photos: PhotoMetadata[]
  selectedPath: string | null
  onSelect: (filePath: string) => void
  onRemove: (filePath: string) => void
  onClear: () => void
}): React.JSX.Element {
  const withError = photos.filter((photo) => photo.error).length

  return (
    <aside className="flex h-full min-h-0 w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
        <p className="flex min-w-0 items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <Images className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            <strong className="font-semibold">{photos.length}</strong>
            {photos.length === 1 ? ' foto' : ' fotos'}
            {withError > 0 && (
              <span className="text-red-600 dark:text-red-400"> · {withError} com erro</span>
            )}
          </span>
        </p>
        <button
          type="button"
          onClick={onClear}
          title="Limpar lote"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <Trash2 className="size-3" aria-hidden />
          Limpar
        </button>
      </div>

      <div className="shrink-0 border-b border-slate-200 px-2 py-2 dark:border-slate-800">
        <CoverageBar photos={photos} />
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {photos.map((photo) => {
          const selected = photo.filePath === selectedPath
          const presentCount = photo.present.length

          return (
            <li key={photo.filePath}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(photo.filePath)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect(photo.filePath)
                  }
                }}
                title="Usar esta foto no painel"
                className={`group flex w-full cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-left ${
                  selected
                    ? 'bg-sky-500/15 ring-1 ring-sky-500/40'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1.5">
                    {photo.error && (
                      <span title={photo.error}>
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-red-500" aria-hidden />
                      </span>
                    )}
                    <p
                      className="truncate text-xs font-medium text-slate-700 dark:text-slate-200"
                      title={photo.filePath}
                    >
                      {photo.fileName}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
                    {photo.error ??
                      [
                        photo.width > 0 ? `${photo.width}×${photo.height}` : null,
                        formatFileSize(photo.fileSize),
                        `${presentCount}/${FIELD_ORDER.length} campos`
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                  </p>
                  {!photo.error && (
                    <p
                      className="mt-1 line-clamp-2 font-mono text-[10px] text-slate-500 dark:text-slate-400"
                      title={FIELD_ORDER.map((key) => formatFieldValue(key, photo) ?? '—').join(' · ')}
                    >
                      {FIELD_ORDER.filter((key) => photo.present.includes(key))
                        .map((key) => formatFieldValue(key, photo))
                        .filter(Boolean)
                        .slice(0, 3)
                        .join(' · ')}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemove(photo.filePath)
                  }}
                  title="Remover do lote"
                  aria-label={`Remover ${photo.fileName}`}
                  className="shrink-0 rounded p-1 text-slate-400 opacity-0 hover:bg-slate-100 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-slate-800 dark:hover:text-red-400"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

/** Cobertura do lote em ícones compactos (cabe na sidebar). */
function CoverageBar({ photos }: { photos: PhotoMetadata[] }): React.JSX.Element {
  const total = photos.length

  return (
    <ul className="flex flex-wrap gap-1">
      {FIELD_ORDER.map((key) => {
        const count = photos.filter((photo) => photo.present.includes(key)).length
        const complete = count === total
        const Icon = fieldIcon(key)

        return (
          <li
            key={key}
            className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
              complete
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : count === 0
                  ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            }`}
            title={`${FIELD_LABEL[key]}: ${count} de ${total} foto(s)`}
          >
            <Icon className="size-3" aria-hidden />
            <span className="font-mono">
              {count}/{total}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
