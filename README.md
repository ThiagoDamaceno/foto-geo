# Foto Geo

Editor visual de carimbo de telemetria para fotos de drone + aplicação em lote.
Desktop Windows, **100% offline**.

**Progresso: 7 de 9 passos** (`ARQUITETURA.md §14`) — MVP funcional (import → editor → perfis →
lote); falta o empacotamento `.exe`. Estado por requisito nas marcas ✅/🔶/⬜ do
`REQUISITOS.md §4` e `§5`. Pontos de atenção do projeto: `ARQUITETURA.md §16`.

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
> `REQUISITOS.md §11.6` e `ARQUITETURA.md §12`.

## Estrutura

```
src/
├── main/                       # processo Node
│   ├── index.ts                # janela, ciclo de vida
│   ├── security.ts             # CSP (rede bloqueada em produção)
│   ├── shortcuts.ts            # F12/DevTools, reload e zoom bloqueados
│   ├── ipc/handlers.ts         # handlers IPC
│   └── services/
│       ├── exif.service.ts     # XMP drone-dji + EXIF → PhotoMetadata
│       ├── render.service.ts   # SVG + Sharp → foto carimbada / preview
│       ├── batch.service.ts    # lote: p-limit, progresso, resumo (RF-09)
│       ├── logo.service.ts     # logo PNG/SVG → PNG + proporção
│       ├── profile.service.ts  # perfis .json (zod) → salvar/abrir/duplicar/excluir
│       ├── icon-markup.ts      # ícones do carimbo (lucide-static)
│       ├── files.service.ts    # valida/expande caminhos do Renderer
│       └── dialog.service.ts   # seletores + abrir pasta de saída
├── preload/                    # contextBridge → window.fotoGeo
├── renderer/                   # React + Tailwind (editor WYSIWYG)
│   └── src/
│       ├── components/         # ImportDropzone, MetadataList, EditorCanvas,
│       │                       # InspectorPanel, FieldList, ProfileBar, BatchPanel,
│       │                       # ProgressBar, ThemeToggle
│       ├── state/              # usePhotos, useTemplate, useProfiles, useBatch
│       └── lib/                # theme, ipc-error, ícones da UI e do carimbo
└── shared/                     # tipos, IPC, geometria, overlay-svg, formatação (os dois lados)
assets/fonts/                   # roboto.ttf (embarcada, offline) — ainda pendente
```

## O que já funciona

1. **Importar** fotos arrastando ou pelos seletores de arquivo/pasta, com a telemetria de cada
   uma na lista (lat, lon, altitude, data, hora, modelo, direção) e a cobertura do lote.
   Arquivo corrompido ou sem metadados entra marcado, sem derrubar o resto (RNF-08).
2. **Montar o carimbo** sobre a foto escolhida: arrastar a seção, mudar largura, fonte,
   entrelinha, margem e cores, reordenar os campos arrastando, e ligar/desligar campo, ícone
   e rótulo um por um.
3. **Posicionar uma logo** (PNG ou SVG) livremente sobre a foto, com largura e opacidade.
4. **Visualizar a saída** com o botão *Visualizar*: carimba a foto em tamanho real
   (8064 × 4536 em ~1,1 s) e mostra o resultado; *Editar* (lápis) volta às alças.
5. **Guardar em perfis** (`.json` em `profiles/` ao lado do exe): salvar, abrir, duplicar e
   excluir quantos perfis quiser — um por cliente/obra, cada um com sua logo. A barra avisa
   quando há *alterações não salvas*; perfil de versão antiga abre com o que é válido e diz o
   que voltou ao padrão.
6. **Aplicar em lote**: escolher pasta de saída (diferente da dos originais), manter o nome ou
   acrescentar `_geo`, processar as N fotos com barra de progresso, cancelar no meio e ver o
   resumo (sucesso / ignoradas / erro) com atalho para abrir a pasta.

O preview **não é um desenho parecido** com a saída: é o mesmo SVG que o Sharp compõe no
arquivo final (`src/shared/overlay-svg.ts`), só escalado. Fonte, ícones (Lucide), posições e
formatação vêm de código compartilhado — ver `ARQUITETURA.md §6`.

## Próximos passos

Ordem de implementação em `ARQUITETURA.md §14`: passos 1–7 feitos. O próximo é o passo 8 —
empacotamento `.exe` Windows (`electron-builder`, binários win-x64 de `sharp` /
`exiftool-vendored`, teste em máquina real). Depois a Fase 2 (passo 9).
