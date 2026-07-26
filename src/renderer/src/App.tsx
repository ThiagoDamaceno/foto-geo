import { useEffect, useState } from 'react'
import { MapPin, Mountain, Calendar, Clock, Plane, Compass } from 'lucide-react'
import ThemeToggle from './components/ThemeToggle'
import { useTheme } from './lib/theme'
import type { AppInfo } from '@shared/types'

/** Placeholder do editor — prova que Renderer, Tailwind, tema, ícones e IPC estão de pé. */
export default function App(): React.JSX.Element {
  const { theme, toggle } = useTheme()
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [ipcStatus, setIpcStatus] = useState<'…' | 'ok' | 'falhou'>('…')

  useEffect(() => {
    void window.fotoGeo
      .getAppInfo()
      .then(setInfo)
      .catch(() => setIpcStatus('falhou'))

    void window.fotoGeo
      .ping()
      .then((r) => setIpcStatus(r === 'pong' ? 'ok' : 'falhou'))
      .catch(() => setIpcStatus('falhou'))
  }, [])

  return (
    <div className="flex h-full flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Foto Geo</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Carimbo de telemetria em lote · 100% offline
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              ipcStatus === 'ok'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : ipcStatus === 'falhou'
                  ? 'bg-red-500/15 text-red-700 dark:text-red-300'
                  : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
            }`}
          >
            IPC: {ipcStatus}
          </span>
          <ThemeToggle theme={theme} onToggle={toggle} />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-xl space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Hello, drone 👋</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Esqueleto Electron + React + TypeScript + Tailwind pronto. Próximo passo:
              leitura de EXIF/XMP{' '}
              <code className="text-slate-700 dark:text-slate-300">drone-dji</code>.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-3 text-sm">
            {[
              { Icon: MapPin, label: 'Latitude / Longitude' },
              { Icon: Mountain, label: 'Altitude' },
              { Icon: Calendar, label: 'Data' },
              { Icon: Clock, label: 'Hora' },
              { Icon: Plane, label: 'Modelo do drone' },
              { Icon: Compass, label: 'Direção' }
            ].map(({ Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
              >
                <Icon className="size-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                {label}
              </li>
            ))}
          </ul>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <Row label="Versão" value={info?.appVersion} />
            <Row label="Electron" value={info?.electron} />
            <Row label="Chromium" value={info?.chrome} />
            <Row label="Node" value={info?.node} />
            <Row label="Plataforma" value={info?.platform} />
            <Row label="Empacotado" value={info ? (info.isPackaged ? 'sim' : 'não') : undefined} />
          </dl>
        </div>
      </main>
    </div>
  )
}

function Row({ label, value }: { label: string; value?: string }): React.JSX.Element {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="font-mono text-slate-700 dark:text-slate-300">{value ?? '—'}</dd>
    </div>
  )
}
