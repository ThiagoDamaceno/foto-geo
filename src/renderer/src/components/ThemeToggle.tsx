import { Moon, Sun } from 'lucide-react'
import type { Theme } from '../lib/theme'

/** Alterna claro ⇄ escuro (RNF-09). */
export default function ThemeToggle({
  theme,
  onToggle
}: {
  theme: Theme
  onToggle: () => void
}): React.JSX.Element {
  const isDark = theme === 'dark'
  const Icon = isDark ? Moon : Sun
  const label = isDark ? 'Escuro' : 'Claro'

  return (
    <button
      type="button"
      onClick={onToggle}
      title={`Tema ${label} — clique para mudar para ${isDark ? 'Claro' : 'Escuro'}`}
      aria-label={`Tema ${label}`}
      className="flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  )
}
