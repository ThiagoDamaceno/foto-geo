# Foto Geo

Editor visual de carimbo de telemetria para fotos de drone + aplicação em lote.
Desktop Windows, **100% offline**.

- **O que é / o que faz:** `REQUISITOS.md`
- **Como é construído:** `ARQUITETURA.md`
- **Requisitos de instalação (detalhado):** `REQUISITOS.md §11`

Stack: Electron + React + TypeScript + Tailwind CSS (via `electron-vite`).

## Requisitos

| Item | Versão |
|------|--------|
| Node.js | **24.18.0** (fixado em `.tool-versions`) |
| Yarn | **1.22.x** (classic) — o lock do projeto é o `yarn.lock` |
| SO de execução | Windows 10/11 x64 |
| SO de desenvolvimento | Windows, Linux ou **WSL2 + WSLg** (ver abaixo) |

> Use **yarn**, não npm — `npm install` criaria um `package-lock.json` divergente.

## Instalação

```bash
yarn install
yarn dev
```

### WSL (Ubuntu)

O binário do Electron precisa de libs que não vêm no WSL enxuto (sem elas ele não inicia:
`error while loading shared libraries: libnspr4.so`):

```bash
sudo apt update
sudo apt install -y libnss3 libnspr4 libasound2t64   # Ubuntu < 24.04: libasound2
```

A janela aparece via **WSLg** — confirme que `echo $DISPLAY` retorna algo (ex.: `:0`).
Não há GPU utilizável no WSL: o Main desliga a aceleração de hardware quando roda em Linux
e o Chromium renderiza por software (suficiente para o editor).

### Fotos de teste vindas do Windows

Dá para testar com fotos reais **sem build no Windows**: use `exemplos/fotos drone/`
(amostra do Lito X1, fora do Git), ou abra os arquivos do Windows pelo seletor do app em
`/mnt/c/Users/<usuário>/...` — o `/mnt` é lento, então copie para dentro do WSL quando for
medir desempenho. **Drag & drop do Explorer não funciona no WSLg** (RF-01 só é testável
rodando no Windows). Detalhes em `REQUISITOS.md §11.4`.

## Scripts

| Comando | O que faz |
|---------|-----------|
| `yarn dev` | Sobe o app em desenvolvimento (HMR no Renderer). |
| `yarn dev:watch` | Idem, reiniciando o processo Main a cada alteração. |
| `yarn typecheck` | `tsc` nos dois projetos (`node` = main/preload, `web` = renderer). |
| `FOTOGEO_DEVTOOLS=1 yarn dev` | Único jeito de abrir o DevTools — F12/console estão desativados (RNF-10). |

## Convenções de UI

- **Tema claro/escuro** (RNF-09): só esses dois modos, alternados no cabeçalho e persistidos
  em `localStorage` (na 1ª execução adota o modo do Windows). Todo componente novo precisa
  das duas variantes (`dark:` do Tailwind).
- **Sem console para o usuário** (RNF-10): F12, `Ctrl+Shift+I/J/C`, reload e zoom por
  teclado bloqueados; menu nativo removido — `src/main/shortcuts.ts`.

> Empacotamento (`.exe` NSIS/portátil) está **postergado** até o MVP fechar —
> `REQUISITOS.md §11.5` e `ARQUITETURA.md §12`.

## Estrutura

```
src/
├── main/                 # processo Node
│   ├── index.ts          # janela, ciclo de vida
│   ├── security.ts       # CSP (rede bloqueada em produção)
│   ├── shortcuts.ts      # F12/DevTools, reload e zoom bloqueados
│   └── ipc/handlers.ts   # handlers IPC
├── preload/              # contextBridge → window.fotoGeo
├── renderer/             # React + Tailwind (editor WYSIWYG)
│   └── src/lib/theme.ts  # tema claro/escuro
└── shared/               # tipos e canais IPC usados pelos dois lados
assets/fonts/             # roboto.ttf (embarcada, offline)
```

## Próximos passos

Ordem de implementação em `ARQUITETURA.md §14`: o passo 1 (esqueleto + IPC) está feito;
o próximo é `exif.service` + canal `photos:scan` sobre as fotos reais do Lito X1.
