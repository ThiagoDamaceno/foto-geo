import { useEffect, useId, useRef, useState } from 'react'
import { CircleHelp, X } from 'lucide-react'

/** Ajuda rápida ao lado do tema — atalhos, formatos e fluxo básico. */
export default function HelpButton(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      setOpen(false)
    }

    // capture: fecha a ajuda sem limpar a seleção do canvas no mesmo Esc
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ajuda e atalhos"
        aria-label="Ajuda e atalhos"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <CircleHelp className="size-4" aria-hidden />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[min(85vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h2 id={titleId} className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Como usar o Foto Geo
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                title="Fechar"
                aria-label="Fechar ajuda"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <Section title="Fotos">
                <p>
                  Arraste arquivos/pastas ou use os botões de importar. Formatos:{' '}
                  <Kbd>JPG</Kbd> <Kbd>JPEG</Kbd> <Kbd>PNG</Kbd> <Kbd>WebP</Kbd> <Kbd>BMP</Kbd>{' '}
                  <Kbd>TIFF</Kbd>.
                </p>
                <p>
                  Telemetria completa (GPS, altitude, direção…) costuma vir em fotos{' '}
                  <strong className="font-medium text-slate-800 dark:text-slate-100">JPG da DJI</strong>
                  . PNG/WebP/BMP muitas vezes não trazem esses dados — o carimbo só mostra o que
                  existir em cada foto.
                </p>
              </Section>

              <Section title="Editor (modo Editar)">
                <p>Clique na seção de dados ou numa logo para selecionar (borda destacada).</p>
                <ul className="mt-1.5 list-inside list-disc space-y-1">
                  <li>
                    <Kbd>←</Kbd> <Kbd>→</Kbd> <Kbd>↑</Kbd> <Kbd>↓</Kbd> — move 1 px na foto
                  </li>
                  <li>
                    <Kbd>Shift</Kbd> + setas — move 10 px
                  </li>
                  <li>
                    <Kbd>Del</Kbd> / <Kbd>Backspace</Kbd> — remove a logo selecionada
                  </li>
                  <li>
                    <Kbd>Esc</Kbd> — tira a seleção
                  </li>
                  <li>Arraste a área tracejada para mover; a bolinha altera a largura</li>
                </ul>
                <p className="mt-1.5">
                  <strong className="font-medium text-slate-800 dark:text-slate-100">Visualizar</strong>{' '}
                  gera a saída real (Sharp). <strong className="font-medium text-slate-800 dark:text-slate-100">Editar</strong>{' '}
                  volta às alças.
                </p>
              </Section>

              <Section title="Logos">
                <p>
                  Dá para ter várias. Formatos: os das fotos + <Kbd>SVG</Kbd>. Na lista do inspector,
                  o item de cima fica por cima na foto — arraste para reordenar. Cada logo tem
                  largura e opacidade próprias.
                </p>
              </Section>

              <Section title="Carimbo e campos">
                <p>
                  No painel direito: largura, fonte, cores, cantos, borda do card. Campos podem ser
                  reordenados (arrastar), ocultados ou ter ícone/rótulo. Divisores são linhas
                  horizontais no card.
                </p>
                <p className="mt-1.5">
                  Posições e tamanhos são <strong className="font-medium text-slate-800 dark:text-slate-100">relativos</strong> à
                  imagem — o mesmo perfil serve em qualquer resolução.
                </p>
              </Section>

              <Section title="Perfis">
                <p>
                  <strong className="font-medium text-slate-800 dark:text-slate-100">Salvar</strong> sobrescreve o
                  perfil aberto.{' '}
                  <strong className="font-medium text-slate-800 dark:text-slate-100">Salvar como novo</strong> cria
                  outro arquivo com o estado atual da tela.{' '}
                  <strong className="font-medium text-slate-800 dark:text-slate-100">Duplicar</strong> copia a última
                  versão já salva no disco.
                </p>
                <p className="mt-1.5">
                  Arquivos em <Kbd>%APPDATA%\foto-geo\profiles</Kbd> (Windows) — pasta de dados do
                  app, não ao lado do .exe. Em desenvolvimento, no <Kbd>userData</Kbd> do Electron.
                  Logos com path sob a pasta do app podem ser salvos relativos. Se o arquivo sumir, o
                  perfil mantém a referência e avisa.
                </p>
              </Section>

              <Section title="Lote">
                <p>
                  Escolha a pasta de saída (não pode ser a mesma das originais). Por padrão o nome do
                  arquivo se mantém; opcionalmente acrescenta <Kbd>_geo</Kbd>. A saída é sempre{' '}
                  <Kbd>JPG</Kbd>. Dá para marcar sobrescrita se o arquivo já existir.
                </p>
              </Section>

              <Section title="Offline">
                <p>Tudo roda no seu computador — sem nuvem e sem envio de fotos.</p>
              </Section>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="space-y-1">
      <h3 className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase dark:text-slate-500">
        {title}
      </h3>
      <div>{children}</div>
    </section>
  )
}

function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <kbd className="rounded border border-slate-300 bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
      {children}
    </kbd>
  )
}
