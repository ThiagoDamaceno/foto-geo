import { useCallback, useEffect, useState } from 'react'

/** Só dois modos de cor (RNF-09). */
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'fotogeo:theme'

/** Sem preferência salva (primeira execução), acompanha o modo de cor do Windows. */
function systemDefault(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : systemDefault()
}

/** `data-theme` no <html> é o que o Tailwind observa (ver `assets/main.css`). */
function apply(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme
}

/** Aplica o tema salvo antes do primeiro paint, evitando flash de tela clara. */
export function initTheme(): void {
  apply(readTheme())
}

export function useTheme(): { theme: Theme; setTheme: (next: Theme) => void; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme)
    apply(theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, setTheme, toggle }
}
