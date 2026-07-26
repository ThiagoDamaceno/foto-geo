import { ImageUp, RotateCcw, Trash2 } from 'lucide-react'
import type {
  FieldConfig,
  FieldKey,
  LogoAsset,
  PhotoMetadata,
  SectionConfig,
  Template
} from '@shared/types'
import FieldList from './FieldList'

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
  logoAsset,
  onPatchSection,
  onReorderFields,
  onPatchField,
  onPickLogo,
  onRemoveLogo,
  onResizeLogo,
  onLogoOpacity,
  onReset
}: {
  template: Template
  photo: PhotoMetadata
  logoAsset: LogoAsset | null
  onPatchSection: (patch: Partial<SectionConfig>) => void
  onReorderFields: (from: number, to: number) => void
  onPatchField: (key: FieldKey, patch: Partial<Omit<FieldConfig, 'key'>>) => void
  onPickLogo: () => void
  onRemoveLogo: () => void
  onResizeLogo: (widthPct: number) => void
  onLogoOpacity: (opacity: number) => void
  onReset: () => void
}): React.JSX.Element {
  const { section } = template
  const px = (pct: number): string => `${Math.round(pct * photo.width)} px`

  return (
    /* rolagem própria e grudado no topo: o canvas é alto e os controles não podem
       ficar fora de alcance */
    <aside className="w-full shrink-0 space-y-5 self-start rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-0 lg:max-h-[calc(100vh-9rem)] lg:w-80 lg:overflow-y-auto dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Carimbo</h2>
        <button
          type="button"
          onClick={onReset}
          title="Voltar ao perfil padrão"
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
          onPatch={onPatchField}
        />
      </Group>

      <Group title="Logo">
        {logoAsset ? (
          <>
            <div className="flex items-center gap-3">
              <img
                src={logoAsset.dataUrl}
                alt=""
                className="h-10 w-16 rounded border border-slate-200 bg-slate-100 object-contain p-1 dark:border-slate-700 dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={onRemoveLogo}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Trash2 className="size-3.5" aria-hidden />
                Remover
              </button>
            </div>
            <Slider
              label="Largura"
              value={template.logo.widthPct}
              min={0.02}
              max={0.6}
              step={0.005}
              hint={px(template.logo.widthPct)}
              onChange={onResizeLogo}
            />
            <Slider
              label="Opacidade"
              value={template.logo.opacity}
              min={0.1}
              max={1}
              step={0.05}
              hint={`${Math.round(template.logo.opacity * 100)}%`}
              onChange={onLogoOpacity}
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Arraste a logo sobre a foto para posicionar.
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={onPickLogo}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ImageUp className="size-4" aria-hidden />
            Escolher logo (PNG/SVG)
          </button>
        )}
      </Group>
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
