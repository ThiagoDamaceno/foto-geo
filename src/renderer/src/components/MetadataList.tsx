import { AlertTriangle, Trash2 } from 'lucide-react'
import { FIELD_LABEL, FIELD_ORDER } from '@shared/field-icons'
import { formatFieldValue, formatFileSize } from '@shared/format'
import type { PhotoMetadata } from '@shared/types'
import { fieldIcon } from '../lib/field-icons'

/** Lista o que cada foto tem e a cobertura do lote (RF-02). */
export default function MetadataList({
  photos,
  selectedPath,
  onSelect,
  onRemove
}: {
  photos: PhotoMetadata[]
  selectedPath: string | null
  onSelect: (filePath: string) => void
  onRemove: (filePath: string) => void
}): React.JSX.Element {
  return (
    <section className="space-y-3">
      <CoverageBar photos={photos} />

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Arquivo</th>
              {FIELD_ORDER.map((key) => (
                <th key={key} className="px-3 py-2 font-medium whitespace-nowrap">
                  {FIELD_LABEL[key]}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {photos.map((photo) => (
              <tr
                key={photo.filePath}
                onClick={() => onSelect(photo.filePath)}
                title="Usar esta foto no preview"
                className={`cursor-pointer border-b border-slate-100 last:border-0 dark:border-slate-800/60 ${
                  photo.filePath === selectedPath
                    ? 'bg-sky-500/10'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                }`}
              >
                <td className="px-3 py-2 align-top">
                  <div className="flex items-start gap-2">
                    {photo.error && (
                      <span title={photo.error}>
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden />
                      </span>
                    )}
                    <div>
                      <p
                        className="max-w-[22rem] truncate font-medium text-slate-700 dark:text-slate-200"
                        title={photo.filePath}
                      >
                        {photo.fileName}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        {photo.error ??
                          [
                            photo.width > 0 ? `${photo.width} × ${photo.height}` : null,
                            formatFileSize(photo.fileSize),
                            photo.photoNumber ? `#${photo.photoNumber}` : null
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                      </p>
                    </div>
                  </div>
                </td>

                {FIELD_ORDER.map((key) => {
                  const value = formatFieldValue(key, photo)
                  return (
                    <td key={key} className="px-3 py-2 align-top whitespace-nowrap">
                      {value ? (
                        <span className="font-mono text-slate-700 dark:text-slate-200">{value}</span>
                      ) : (
                        <span
                          className="text-amber-600 dark:text-amber-500"
                          title={`Sem ${FIELD_LABEL[key].toLowerCase()} nesta foto`}
                        >
                          —
                        </span>
                      )}
                    </td>
                  )
                })}

                <td className="px-3 py-2 align-top">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemove(photo.filePath)
                    }}
                    title="Remover do lote"
                    aria-label={`Remover ${photo.fileName}`}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800 dark:hover:text-red-400"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Visão do lote: quantas fotos têm cada campo. */
function CoverageBar({ photos }: { photos: PhotoMetadata[] }): React.JSX.Element {
  const total = photos.length

  return (
    <ul className="flex flex-wrap gap-2">
      {FIELD_ORDER.map((key) => {
        const count = photos.filter((photo) => photo.present.includes(key)).length
        const complete = count === total
        const Icon = fieldIcon(key)

        return (
          <li
            key={key}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              complete
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : count === 0
                  ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            }`}
            title={`${FIELD_LABEL[key]}: ${count} de ${total} foto(s)`}
          >
            <Icon className="size-3.5" aria-hidden />
            {FIELD_LABEL[key]}
            <span className="font-mono">
              {count}/{total}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
