import { useCallback, useState } from 'react'
import { FolderOpen, ImagePlus, Loader2, Upload } from 'lucide-react'

/**
 * Import por drag & drop e por seletor (RF-01).
 *
 * O caminho real do arquivo vem de `webUtils.getPathForFile` — o Electron não expõe mais
 * `File.path`. Pastas soltas também funcionam: o Main expande.
 * ⚠️ No WSLg o arrastar-e-soltar do Explorer do Windows não funciona (REQUISITOS.md §11.4).
 */
export default function ImportDropzone({
  isScanning,
  compact,
  onDropPaths,
  onPickImages,
  onPickFolder
}: {
  isScanning: boolean
  compact: boolean
  onDropPaths: (paths: string[]) => void
  onPickImages: () => void
  onPickFolder: () => void
}): React.JSX.Element {
  const [isOver, setIsOver] = useState(false)

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>): void => {
      event.preventDefault()
      setIsOver(false)

      const paths = [...event.dataTransfer.files]
        .map((file) => window.electron.webUtils.getPathForFile(file))
        .filter((path) => path !== '')

      if (paths.length > 0) onDropPaths(paths)
    },
    [onDropPaths]
  )

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed text-center transition-colors ${
        compact ? 'px-6 py-4' : 'px-8 py-14'
      } ${
        isOver
          ? 'border-sky-500 bg-sky-500/10'
          : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900/40'
      }`}
    >
      {isScanning ? (
        <Loader2 className="size-6 animate-spin text-sky-600 dark:text-sky-400" aria-hidden />
      ) : (
        <Upload
          className={`${compact ? 'size-5' : 'size-8'} text-slate-400 dark:text-slate-500`}
          aria-hidden
        />
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {isScanning ? 'Lendo metadados…' : 'Arraste fotos ou uma pasta aqui'}
        </p>
        {!compact && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            JPG do drone é o formato principal · PNG, BMP, TIFF e WEBP entram, mas costumam não
            ter telemetria
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPickImages}
          disabled={isScanning}
          className="flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          <ImagePlus className="size-4" aria-hidden />
          Selecionar fotos
        </button>
        <button
          type="button"
          onClick={onPickFolder}
          disabled={isScanning}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <FolderOpen className="size-4" aria-hidden />
          Selecionar pasta
        </button>
      </div>
    </div>
  )
}
