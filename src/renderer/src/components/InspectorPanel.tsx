import { ImageUp, Minus, RotateCcw } from 'lucide-react'
import type {
  DividerConfig,
  FieldConfig,
  FieldKey,
  LogoAsset,
  LogoConfig,
  PhotoMetadata,
  SectionConfig,
  Template
} from '@shared/types'
import FieldList from './FieldList'
import LogoList from './LogoList'

/**
 * Controles do carimbo (RF-05/RF-06). Tudo aqui escreve no `Template`, que é a fonte única do
 * preview e da saída — por isso qualquer mexida aparece na hora sobre a foto.
 *
 * Os tamanhos são **relativos** à largura da imagem; ao lado de cada um mostramos o px
 * equivalente na foto atual, que é o número que o usuário enxerga.
 */
export default function InspectorPanel({
  template,
  photo,
  logoAssets,
  onPatchSection,
  onReorderFields,
  onPatchField,
  onAddDivider,
  onPatchDivider,
  onRemoveDivider,
  onAddLogos,
  onReorderLogos,
  onPatchLogo,
  onRemoveLogo,
  selectedLogoId,
  onSelectLogo,
  onReset
}: {
  template: Template
  photo: PhotoMetadata
  logoAssets: Record<string, LogoAsset>
  onPatchSection: (patch: Partial<SectionConfig>) => void
  onReorderFields: (from: number, to: number) => void
  onPatchField: (key: FieldKey, patch: Partial<Omit<FieldConfig, 'key'>>) => void
  onAddDivider: () => void
  onPatchDivider: (id: string, patch: Partial<Omit<DividerConfig, 'type' | 'id'>>) => void
  onRemoveDivider: (id: string) => void
  onAddLogos: () => void
  onReorderLogos: (from: number, to: number) => void
  onPatchLogo: (id: string, patch: Partial<Omit<LogoConfig, 'id' | 'filePath'>>) => void
  onRemoveLogo: (id: string) => void
  selectedLogoId: string | null
  onSelectLogo: (id: string) => void
  onReset: () => void
}): React.JSX.Element {
  const { section } = template
  const px = (pct: number): string => `${Math.round(pct * photo.width)} px`

  return (
    /* coluna direita do workspace: rolagem própria para os controles não sumirem */
    <aside className="flex h-full min-h-0 w-80 shrink-0 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Carimbo</h2>
        <button
          type="button"
          onClick={onReset}
          title="Zera o carimbo para o padrão, mantendo o perfil aberto (salvar sobrescreve este perfil)"
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Padrão
        </button>
      </div>

      <Group title="Seção">
        <Slider
          label="Largura"
          value={section.widthPct}
          min={0.08}
          max={1}
          step={0.005}
          hint={px(section.widthPct)}
          onChange={(widthPct) => onPatchSection({ widthPct })}
        />
        <Slider
          label="Fonte"
          value={section.fontPct}
          min={0.006}
          max={0.04}
          step={0.0005}
          hint={px(section.fontPct)}
          onChange={(fontPct) => onPatchSection({ fontPct })}
        />
        <Slider
          label="Entrelinha"
          value={section.lineGapPct}
          min={0}
          max={0.02}
          step={0.0005}
          hint={px(section.lineGapPct)}
          onChange={(lineGapPct) => onPatchSection({ lineGapPct })}
        />
        <Slider
          label="Margem interna"
          value={section.paddingPct}
          min={0}
          max={0.03}
          step={0.0005}
          hint={px(section.paddingPct)}
          onChange={(paddingPct) => onPatchSection({ paddingPct })}
        />
        <Slider
          label="Cantos arredondados"
          value={section.radiusPct}
          min={0}
          max={0.04}
          step={0.0005}
          hint={section.radiusPct === 0 ? 'reto' : px(section.radiusPct)}
          onChange={(radiusPct) => onPatchSection({ radiusPct })}
        />
        <label className="inline-flex items-center gap-2 text-xs leading-none text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={section.showBorder}
            onChange={(event) => onPatchSection({ showBorder: event.target.checked })}
            className="size-3.5 shrink-0 accent-sky-600"
          />
          <span>Borda do card</span>
        </label>
      </Group>

      <Group title="Cores">
        <div className="flex items-center gap-3">
          <Color
            label="Fundo"
            value={section.bgColor}
            onChange={(bgColor) => onPatchSection({ bgColor })}
          />
          <Color
            label="Texto"
            value={section.textColor}
            onChange={(textColor) => onPatchSection({ textColor })}
          />
        </div>
        <Slider
          label="Opacidade do fundo"
          value={section.bgOpacity}
          min={0}
          max={1}
          step={0.05}
          hint={`${Math.round(section.bgOpacity * 100)}%`}
          onChange={(bgOpacity) => onPatchSection({ bgOpacity })}
        />
      </Group>

      <Group title="Campos e ordem">
        <FieldList
          fields={section.fields}
          photo={photo}
          onReorder={onReorderFields}
          onPatchField={onPatchField}
          onPatchDivider={onPatchDivider}
          onRemoveDivider={onRemoveDivider}
        />
        <button
          type="button"
          onClick={onAddDivider}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Minus className="size-3.5" aria-hidden />
          Adicionar divisor
        </button>
      </Group>

      <Group title="Logos">
        <LogoList
          logos={template.logos}
          assets={logoAssets}
          photoWidth={photo.width}
          selectedId={selectedLogoId}
          onSelect={onSelectLogo}
          onReorder={onReorderLogos}
          onPatch={onPatchLogo}
          onRemove={onRemoveLogo}
        />
        <button
          type="button"
          onClick={onAddLogos}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ImageUp className="size-4" aria-hidden />
          Adicionar logo (PNG, SVG, WebP…)
        </button>
        {template.logos.length > 0 && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            O item de cima fica por cima na foto. Arraste na lista para reordenar; na foto, arraste
            para posicionar.
          </p>
        )}
      </Group>
      </div>
    </aside>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  hint,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  hint: string
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between text-xs text-slate-600 dark:text-slate-300">
        {label}
        <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">{hint}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-sky-600"
      />
    </label>
  )
}

function Color({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className="size-7 cursor-pointer rounded border border-slate-300 bg-transparent dark:border-slate-700"
      />
      {label}
    </label>
  )
}
