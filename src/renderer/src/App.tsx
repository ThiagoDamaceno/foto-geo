import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileWarning } from 'lucide-react'
import BatchPanel from './components/BatchPanel'
import EditorCanvas from './components/EditorCanvas'
import ImportDropzone from './components/ImportDropzone'
import InspectorPanel from './components/InspectorPanel'
import MetadataList from './components/MetadataList'
import ProfileBar from './components/ProfileBar'
import ThemeToggle from './components/ThemeToggle'
import { useTheme } from './lib/theme'
import { useBatch } from './state/useBatch'
import { usePhotos } from './state/usePhotos'
import { useProfiles } from './state/useProfiles'
import { useTemplate } from './state/useTemplate'
import type { AppInfo } from '@shared/types'

export default function App(): React.JSX.Element {
  const { theme, toggle } = useTheme()
  const {
    photos,
    ignored,
    isScanning,
    error,
    importPaths,
    pickImages,
    pickFolder,
    removePhoto,
    clear
  } = usePhotos()
  const {
    template,
    logoAsset,
    setName,
    moveSection,
    resizeSection,
    patchSection,
    reorderFields,
    patchField,
    addDivider,
    patchDivider,
    removeDivider,
    moveLogo,
    resizeLogo,
    setLogoOpacity,
    setLogoAsset,
    applyTemplate,
    reset
  } = useTemplate()
  const profiles = useProfiles(template, applyTemplate, reset)
  const batch = useBatch(template)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)

  const pickLogo = useCallback(async (): Promise<void> => {
    setLogoError(null)
    try {
      const asset = await window.fotoGeo.pickLogo()
      if (asset) setLogoAsset(asset)
    } catch (cause) {
      setLogoError(cause instanceof Error ? cause.message : String(cause))
    }
  }, [setLogoAsset])

  /** Foto de referência do editor: a escolhida, ou a primeira com telemetria e tamanho. */
  const selected = useMemo(() => {
    const byPath = photos.find((photo) => photo.filePath === selectedPath)
    return byPath ?? photos.find((photo) => photo.width > 0 && !photo.error) ?? null
  }, [photos, selectedPath])

  useEffect(() => {
    // Sem console para o usuário (RNF-10): um erro aqui não pode derrubar a árvore
    // do React e deixar a janela em branco.
    try {
      void window.fotoGeo.getAppInfo().then(setInfo).catch(() => setInfo(null))
    } catch {
      setInfo(null)
    }
  }, [])

  const hasPhotos = photos.length > 0

  return (
    <div className="flex h-full flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-6 py-3 dark:border-slate-800">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Foto Geo</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Carimbo de telemetria em lote · 100% offline
          </p>
        </div>
        <ThemeToggle theme={theme} onToggle={toggle} />
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
        <div className="shrink-0 space-y-3">
          <ImportDropzone
            isScanning={isScanning}
            compact={hasPhotos}
            onDropPaths={(paths) => void importPaths(paths)}
            onPickImages={() => void pickImages()}
            onPickFolder={() => void pickFolder()}
          />

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              Falha ao importar: {error}
            </p>
          )}

          {ignored.length > 0 && (
            <ul className="space-y-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              {ignored.map((item) => (
                <li key={item.filePath} className="flex items-center gap-2">
                  <FileWarning className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate" title={item.filePath}>
                    {item.filePath}
                  </span>
                  <span className="shrink-0 opacity-75">— {item.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasPhotos ? (
          <>
            {selected && (
              <div className="shrink-0 space-y-3">
                {logoError && (
                  <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                    Logo: {logoError}
                  </p>
                )}
                <ProfileBar
                  profiles={profiles.profiles}
                  activeId={profiles.activeId}
                  name={template.name}
                  isDirty={profiles.isDirty}
                  isBusy={profiles.isBusy}
                  error={profiles.error}
                  warnings={profiles.warnings}
                  onName={setName}
                  onLoad={(id) => void profiles.load(id)}
                  onSave={() => void profiles.save()}
                  onSaveAsNew={() => void profiles.saveAsNew()}
                  onDuplicate={(id) => void profiles.duplicate(id)}
                  onDelete={(id) => void profiles.remove(id)}
                  onNew={profiles.detach}
                  onDismiss={profiles.dismiss}
                />
              </div>
            )}

            {/* Imagens | Painel | Menu de edição */}
            <div className="flex min-h-0 flex-1 gap-3">
              <MetadataList
                photos={photos}
                selectedPath={selected?.filePath ?? null}
                onSelect={setSelectedPath}
                onRemove={removePhoto}
                onClear={clear}
              />

              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
                {selected ? (
                  <EditorCanvas
                    photo={selected}
                    template={template}
                    logoAsset={logoAsset}
                    onMoveSection={moveSection}
                    onResizeSection={resizeSection}
                    onMoveLogo={moveLogo}
                    onResizeLogo={resizeLogo}
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Selecione uma foto na lista à esquerda
                  </div>
                )}

                <BatchPanel
                  photoCount={photos.length}
                  sampleName={photos[0]?.fileName ?? null}
                  outputDir={batch.outputDir}
                  naming={batch.naming}
                  overwrite={batch.overwrite}
                  isRunning={batch.isRunning}
                  progress={batch.progress}
                  result={batch.result}
                  error={batch.error}
                  onPickOutputDir={() => void batch.pickOutputDir()}
                  onNaming={batch.setNaming}
                  onOverwrite={batch.setOverwrite}
                  onStart={() => void batch.start(photos.map((photo) => photo.filePath))}
                  onCancel={() => void batch.cancel()}
                  onOpenOutput={() => void batch.openOutput()}
                  onDismiss={batch.dismiss}
                />
              </div>

              {selected ? (
                <InspectorPanel
                  template={template}
                  photo={selected}
                  logoAsset={logoAsset}
                  onPatchSection={patchSection}
                  onReorderFields={reorderFields}
                  onPatchField={patchField}
                  onAddDivider={addDivider}
                  onPatchDivider={patchDivider}
                  onRemoveDivider={removeDivider}
                  onPickLogo={() => void pickLogo()}
                  onRemoveLogo={() => setLogoAsset(null)}
                  onResizeLogo={resizeLogo}
                  onLogoOpacity={setLogoOpacity}
                  onReset={reset}
                />
              ) : (
                <aside className="flex w-80 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Menu de edição
                </aside>
              )}
            </div>
          </>
        ) : (
          !isScanning && (
            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              Nenhuma foto importada ainda. Arraste arquivos ou use os seletores acima para
              começar.
            </p>
          )
        )}
      </main>

      <footer className="shrink-0 border-t border-slate-200 px-6 py-2 text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-500">
        {info
          ? `v${info.appVersion} · Electron ${info.electron} · Chromium ${info.chrome} · Node ${info.node} · ${info.platform}`
          : '—'}
      </footer>
    </div>
  )
}
