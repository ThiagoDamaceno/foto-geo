import { useEffect, useState } from 'react'
import { Copy, FileJson, FilePlus2, Save, SaveAll, Trash2, TriangleAlert, X } from 'lucide-react'
import type { ProfileSummary } from '@shared/types'

/**
 * Perfis salvos (RF-07). O nome editado aqui é o `name` do template — é ele que dá origem ao
 * nome do arquivo `.json` na primeira gravação.
 *
 * "Salvar" sobrescreve o perfil aberto; renomear e salvar **não** cria arquivo novo (o perfil é
 * identificado pelo arquivo, não pelo nome) — para isso existe o "Salvar como novo".
 */
export default function ProfileBar({
  profiles,
  activeId,
  name,
  isDirty,
  isBusy,
  error,
  warnings,
  onName,
  onLoad,
  onSave,
  onSaveAsNew,
  onDuplicate,
  onDelete,
  onNew,
  onDismiss
}: {
  profiles: ProfileSummary[]
  activeId: string | null
  name: string
  isDirty: boolean
  isBusy: boolean
  error: string | null
  warnings: string[]
  onName: (name: string) => void
  onLoad: (id: string) => void
  onSave: () => void
  onSaveAsNew: () => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  onDismiss: () => void
}): React.JSX.Element {
  // exclusão em dois toques: não há diálogo nativo de confirmação no Renderer
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => setConfirmDelete(false), [activeId])

  const active = profiles.find((profile) => profile.id === activeId) ?? null
  const canSave = name.trim().length > 0 && !isBusy

  return (
    <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center gap-2">
        <FileJson className="size-4 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />

        <label className="sr-only" htmlFor="profile-select">
          Perfil salvo
        </label>
        <select
          id="profile-select"
          value={activeId ?? ''}
          disabled={isBusy}
          onChange={(event) => {
            if (event.target.value) onLoad(event.target.value)
          }}
          className="min-w-44 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="">{profiles.length > 0 ? 'Abrir perfil…' : 'Nenhum perfil salvo'}</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.error ? `${profile.name} (ilegível)` : profile.name}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="profile-name">
          Nome do perfil
        </label>
        <input
          id="profile-name"
          value={name}
          maxLength={60}
          placeholder="Nome do perfil"
          onChange={(event) => onName(event.target.value)}
          className="min-w-44 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        />

        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          {isBusy
            ? 'salvando…'
            : active
              ? isDirty
                ? '• alterações não salvas'
                : `salvo · ${formatUpdatedAt(active.updatedAt)}`
              : 'perfil não salvo'}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Action icon={Save} label={active ? 'Salvar' : 'Salvar perfil'} onClick={onSave} disabled={!canSave} primary />
          {active && (
            <Action icon={SaveAll} label="Salvar como novo" onClick={onSaveAsNew} disabled={!canSave} />
          )}
          {active && (
            <Action
              icon={Copy}
              label="Duplicar"
              onClick={() => onDuplicate(active.id)}
              disabled={isBusy}
            />
          )}
          {active &&
            (confirmDelete ? (
              <>
                <Action
                  icon={Trash2}
                  label="Confirmar exclusão"
                  onClick={() => {
                    setConfirmDelete(false)
                    onDelete(active.id)
                  }}
                  disabled={isBusy}
                  danger
                />
                <Action icon={X} label="Cancelar" onClick={() => setConfirmDelete(false)} />
              </>
            ) : (
              <Action
                icon={Trash2}
                label="Excluir"
                onClick={() => setConfirmDelete(true)}
                disabled={isBusy}
              />
            ))}
          <Action icon={FilePlus2} label="Novo (padrão)" onClick={onNew} disabled={isBusy} />
        </div>
      </div>

      {error && (
        <Message tone="error" onDismiss={onDismiss}>
          Perfil: {error}
        </Message>
      )}

      {warnings.length > 0 && (
        <Message tone="warning" onDismiss={onDismiss}>
          <ul className="space-y-0.5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Message>
      )}
    </section>
  )
}

function Action({
  icon: Icon,
  label,
  onClick,
  disabled,
  primary,
  danger
}: {
  icon: typeof Save
  label: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  danger?: boolean
}): React.JSX.Element {
  const tone = primary
    ? 'border-sky-600 bg-sky-600 text-white hover:bg-sky-500 dark:border-sky-500 dark:bg-sky-600'
    : danger
      ? 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40'
      : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-40 ${tone}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </button>
  )
}

function Message({
  tone,
  onDismiss,
  children
}: {
  tone: 'error' | 'warning'
  onDismiss: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const colors =
    tone === 'error'
      ? 'bg-red-500/10 text-red-700 dark:text-red-300'
      : 'bg-amber-500/10 text-amber-800 dark:text-amber-300'

  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${colors}`}>
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <div className="flex-1">{children}</div>
      <button type="button" onClick={onDismiss} title="Fechar" className="shrink-0 opacity-70 hover:opacity-100">
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}

/**
 * `dd/mm hh:mm` (RNF-07). Aqui o `Date` é o certo — ao contrário da data da foto (que preserva
 * o fuso da câmera), esta é a hora da gravação e deve aparecer no fuso da máquina.
 */
function formatUpdatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
