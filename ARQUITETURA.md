# Arquitetura Base — Foto Geo (Electron + React + TS + Tailwind + Vite)

> **Documento de arquitetura — v3.** Complementa `REQUISITOS.md`.
> App **desktop Windows offline**: editor visual de template de telemetria + aplicação em lote, com perfis em `.json`.
> Ajustado à **amostra real** (13 fotos JPG do DJI Lito X1, `8064×4536`, EXIF + XMP `drone-dji`) — ver `REQUISITOS §8`.

---

## 1. Visão geral

Dois processos, com **separação estrita**: a UI/editor roda no **Renderer (React)**; a leitura de metadados e a geração final das imagens rodam no **Main (Node)**.

```
┌──────────────────────────────────────────────────────────────────┐
│                         APLICATIVO ELECTRON                        │
│                                                                    │
│  ┌───────────────────────────────┐    ┌────────────────────────┐  │
│  │  RENDERER (React+TS+Tailwind)  │    │   MAIN (Node + TS)     │  │
│  │                                │    │                        │  │
│  │  • Import (drag & drop)        │IPC │  • EXIF/XMP (exiftool) │  │
│  │  • Lista de metadados          │<──>│  • Render final (Sharp)│  │
│  │  • EDITOR WYSIWYG:             │    │  • Lote + concorrência │  │
│  │    seção, campos (DnD),        │    │  • Perfis .json (ler/  │  │
│  │    fonte, tamanho, ícones,     │    │    gravar)             │  │
│  │    logo livre                  │    │  • FS / cópias         │  │
│  │  • Preview ao vivo             │    │                        │  │
│  │  • Progresso / resumo          │    │                        │  │
│  └───────────────────────────────┘    └────────────────────────┘  │
│               ▲   preload.ts (contextBridge)   │                   │
│               └──────────────────────────────► │                   │
└──────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼   Sistema de arquivos (Windows)
                       imagens de entrada · perfis .json · logos · saída
```

**Regra de ouro:** o **template** (config) é a fonte única. O Renderer o edita e exibe **o mesmo SVG** que o Main compõe com o Sharp no arquivo final — não há dois layouts para conciliar (§6). Os dois lados usam o **mesmo código** de geometria e formatação (§7) → preview = saída.

---

## 2. Stack

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Shell | **Electron** | `.exe` Windows offline. |
| UI | **React + TypeScript** | Requisito. |
| Estilo | **Tailwind CSS** | Requisito; agiliza o layout do editor. |
| Dev/build | **electron-vite** + **Vite** | Template Electron+React+TS pronto, HMR. |
| EXIF/XMP | **`exiftool-vendored`** | Lê o namespace **XMP `drone-dji`** (GPS decimal, Absolute/RelativeAltitude, GimbalYaw, ProductName) **e** o EXIF (GPS DMS, GPSAltitude, DateTime); binário offline. |
| Render imagem | **`sharp`** (libvips) | Composição rápida em lote; SVG→imagem. |
| Overlay | **SVG dinâmico** | Texto/ícones escaláveis; base do "espelhamento". |
| Ícones | **`lucide-react`** (UI) + **`lucide-static`** (SVG p/ o Sharp) | Mesmos ícones nos dois lados → fidelidade. |
| Fonte | **Roboto** (arquivo `.ttf` local, embarcado) | Offline; embutida em base64 no SVG do render. |
| Drag & drop (reordenar campos) | **`@dnd-kit`** (+ `sortable`, `modifiers`) | Leve, acessível, TS-first. |
| Drag livre (seção/logo no canvas) | Ponteiro + coords relativas (custom) | `DragBox` no `EditorCanvas`: 40 linhas contra uma dependência a mais, e já trabalha em fração da imagem. |
| Perfis | **JSON** (`fs` + `JSON.parse/stringify`) | Sem lib extra; suporta listas/aninhamento nativamente. |
| Concorrência lote | **`p-limit`** | Limita imagens simultâneas. |
| Empacotar | **`electron-builder`** | NSIS + portátil Windows. |

> Módulos nativos (`sharp`, `exiftool-vendored`): empacotar binários **win-x64** via `electron-builder` (+ rebuild p/ a versão do Electron).
> O `exiftool-vendored` roda como **processo filho** (uma instância `ExifTool` com `maxProcs: 2`, encerrada no `will-quit`); no Linux ele usa o **perl do sistema**, no Windows o `exiftool.exe` embarcado — ver `REQUISITOS.md §11.3`.

---

## 3. Estrutura de pastas

```
foto-geo/
├── electron.vite.config.ts
├── package.json / tsconfig.json (+ tsconfig.node.json, tsconfig.web.json)
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── security.ts                # CSP (rede bloqueada em produção — §11)
│   │   ├── shortcuts.ts               # bloqueio de F12/DevTools, reload e zoom (RNF-10)
│   │   ├── ipc/handlers.ts
│   │   └── services/
│   │       ├── exif.service.ts        # XMP drone-dji (prioridade) + EXIF (fallback) → PhotoMetadata
│   │       ├── files.service.ts       # valida/expande os caminhos vindos do Renderer
│   │       ├── dialog.service.ts      # seletores de arquivos e de pasta
│   │       ├── render.service.ts      # template + foto → SVG → Sharp → arquivo/preview
│   │       ├── logo.service.ts        # logo PNG/SVG → PNG + proporção (RF-06)
│   │       ├── icon-markup.ts         # ícones Lucide (lucide-static) para o SVG do carimbo
│   │       ├── batch.service.ts       # lote, progresso, concorrência
│   │       └── profile.service.ts     # JSON <-> Template (ler/gravar/listar)
│   ├── preload/index.ts               # contextBridge (API segura)
│   ├── renderer/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ImportDropzone.tsx       # drag & drop + seletores (RF-01)
│   │   │   ├── MetadataList.tsx        # o que cada foto tem + cobertura do lote (RF-02)
│   │   │   ├── EditorCanvas.tsx        # foto + overlay SVG + alças (seção e logo)
│   │   │   ├── InspectorPanel.tsx      # largura, fonte, espaçamentos, cores, logo
│   │   │   ├── FieldList.tsx           # campos: reordenar (dnd-kit) e ligar/desligar
│   │   │   ├── ProfileBar.tsx          # escolher/salvar/duplicar perfil (passo 6)
│   │   │   ├── ProgressBar.tsx / SummaryPanel.tsx   # lote (passo 7)
│   │   │   └── ThemeToggle.tsx          # alterna claro ⇄ escuro (RNF-09)
│   │   ├── state/
│   │   │   ├── usePhotos.ts            # lote importado
│   │   │   └── useTemplate.ts          # template em edição + logo carregada
│   │   ├── lib/theme.ts                # tema: data-theme no <html> + localStorage
│   │   ├── lib/field-icons.ts          # FieldKey -> componente lucide-react (UI do app)
│   │   └── lib/icon-markup.ts         # ícones Lucide para o SVG do carimbo (lucide-static)
│   └── shared/
│       ├── types.ts                    # Template, PhotoMetadata, etc.
│       ├── ipc-channels.ts             # nomes dos canais IPC (§5)
│       ├── field-icons.ts             # mapa fixo FieldKey -> nome do ícone Lucide + rótulos
│       ├── format.ts                   # DMS, data BR, altitude… (usado pelos DOIS lados)
│       ├── geometry.ts                 # coords relativas <-> px (§7) — os DOIS lados
│       ├── overlay-svg.ts              # gera o SVG do carimbo — os DOIS lados (§9)
│       ├── image-formats.ts            # extensões aceitas no import (RF-01)
│       └── template-defaults.ts        # perfil padrão
├── assets/fonts/roboto.ttf             # fonte embarcada (offline)
├── profiles/                           # perfis .json + logos do usuário
└── build/                              # ícones do app, config builder (só na fase de empacotamento — §12)
```

> **Estado atual (passos 1–5 do §14 concluídos):** esqueleto + IPC, import com leitura de
> telemetria, geração do carimbo (`shared/overlay-svg` + `render.service`), preview fiel e o
> **editor completo** — seção e logo arrastáveis/redimensionáveis, ordem dos campos por DnD e
> inspector (largura, fonte, espaçamentos, cores, rótulos, visibilidade). Faltam
> `profile.service` (passo 6) e `batch.service` (passo 7).
> Instalação/execução: `REQUISITOS.md §11`.
>
> `SectionElement`/`LogoElement`/`FieldRow` não viraram arquivos próprios: como a parte visual
> é o SVG, sobrou uma alça genérica (`DragBox`, dentro do `EditorCanvas`) usada pelos dois
> elementos, e a linha de campo vive dentro do `FieldList`.
>
> **Desvios conscientes** (ambos para reforçar o RNF-05 — uma implementação só para preview e
> saída, em vez de duas que precisam "combinar"):
> - `format.util` previsto em `main/services/` virou **`shared/format.ts`**.
> - `overlay-svg.ts` e `geometry.ts` também moraram em **`shared/`**, não no Main/Renderer.
>   O preview **não redesenha** o carimbo em HTML/CSS: ele exibe o **mesmo SVG** que o Sharp
>   compõe no arquivo final (ver §6).

---

## 4. O modelo central: `Template`

Fonte única de verdade, compartilhada Main⇄Renderer e serializada em `.json` (§8).

```ts
// src/shared/types.ts
export type FieldKey =
  | 'latitude' | 'longitude' | 'altitude'
  | 'date' | 'time' | 'model' | 'direction';

export interface FieldConfig {
  key: FieldKey;
  visible: boolean;
  showIcon: boolean;       // ícone é FIXO por campo (field-icons.ts); aqui só liga/desliga
  showLabel: boolean;      // "Latitude:" antes do valor?
}

export interface SectionConfig {
  // posição/tamanho RELATIVOS à imagem (0..1) — independe da resolução
  x: number;               // 0..1 (borda esquerda da seção)
  y: number;               // 0..1 (borda superior da seção)
  widthPct: number;        // largura da seção / largura da imagem
  fontFamily: string;      // "Roboto" (embarcada)
  fontPct: number;         // altura da fonte / largura da imagem
  lineGapPct: number;      // espaçamento entre linhas
  paddingPct: number;
  bgColor: string;         // ex. "#000000"
  bgOpacity: number;       // 0..1
  textColor: string;
  align: 'left' | 'center' | 'right';
  fields: FieldConfig[];   // ORDEM = ordem vertical (DnD reordena isto)
}

export interface LogoConfig {
  filePath: string | null; // PNG/SVG
  x: number; y: number;    // 0..1 (livre)
  widthPct: number;        // largura relativa
  opacity: number;
}

export interface Template {          // == 1 PERFIL
  name: string;
  section: SectionConfig;
  logo: LogoConfig;
}
```

Outros tipos:

```ts
export interface PhotoMetadata {
  filePath: string; fileName: string;
  width: number; height: number;                 // ex. 8064 x 4536
  latitude?: number; longitude?: number;          // graus DECIMAIS com sinal (S/W negativos)
  absoluteAltitude?: number;                      // GPSAltitude / drone-dji:AbsoluteAltitude (m) — carimbo padrão
  relativeAltitude?: number;                      // drone-dji:RelativeAltitude (m, à decolagem) — opcional
  dateTimeOriginal?: string;                      // ISO; origem EXIF DateTimeOriginal ou XMP CreateDate
  direction?: number;                             // drone-dji:GimbalYawDegree normalizado 0..360
  droneModel?: string;                            // drone-dji:ProductName ("Lito X1"), NÃO o Model do sensor
  photoNumber?: string;                           // nº sequencial do nome do arquivo (…_NNNN_…)
  present: FieldKey[];      // o que existe nesta foto (RF-02)
}

export interface BatchConfig { photos: string[]; outputDir: string; template: Template; }
export interface JobProgress { total: number; processed: number; currentFile: string;
  succeeded: number; skipped: number; failed: number; }
export interface JobResult  { total: number; succeeded: number; skipped: number;
  failed: number; outputDir: string; errors: {file:string; reason:string}[]; }
```

---

## 5. IPC (Main ⇄ Renderer, via contextBridge)

| Canal | Direção | Função |
|-------|---------|--------|
| `app:ping` / `app:info` | R→M invoke | ✅ Sanity check do IPC e versões do runtime. |
| `dialog:pickImages` / `dialog:pickFolder` | R→M invoke | ✅ Selecionar imagens/pasta (pasta devolve as imagens de dentro, até 4 níveis). |
| `photos:scan` | R→M invoke | ✅ Recebe arquivos e/ou pastas, valida os caminhos e devolve `ScanResult` (`PhotoMetadata[]` com `present` + `ignored[]`). |
| `photos:preview` | R→M invoke | ✅ Foto reduzida (data URL) para o fundo do editor — o original tem ~36 MP. |
| `preview:render` | R→M invoke | ✅ Carimba 1 foto em tamanho real com o Sharp e devolve reduzida + tempo, para conferir a fidelidade. |
| `profiles:list` / `profiles:load` / `profiles:save` / `profiles:duplicate` | R→M invoke | ⬜ CRUD de perfis `.json` (passo 6). |
| `logo:pick` | R→M invoke | ✅ Selecionar PNG/SVG da logo → `LogoAsset` (PNG + proporção). |
| `logo:read` | R→M invoke | ✅ Recarregar uma logo já referenciada por um perfil (cache por mtime). |
| `batch:start` / `batch:cancel` | R→M invoke | Rodar/cancelar lote. |
| `batch:progress` / `batch:done` | M→R send | `JobProgress` / `JobResult`. |
| `shell:openPath` | R→M invoke | Abrir pasta de saída. |

API no preload: `window.fotoGeo = { ping, getAppInfo, pickImages, pickFolder, scanPhotos, renderPreview, listProfiles, loadProfile, saveProfile, pickLogo, startBatch, cancelBatch, openPath, onProgress, onDone }` — as cinco primeiras já existem.

O **caminho real** de um arquivo arrastado vem de `window.electron.webUtils.getPathForFile(file)`
(`@electron-toolkit/preload`): o Electron removeu o `File.path`. O Renderer só manda caminhos;
quem valida (existe? extensão aceita? é pasta?) é o `files.service` no Main.

---

## 6. Editor WYSIWYG (Renderer)

`EditorCanvas` = foto reduzida (`photos:preview`) + **o mesmo SVG do carimbo** por cima, gerado
por `shared/overlay-svg.ts` no tamanho real da foto e apenas escalado pelo navegador (é vetor).

> **Decisão de arquitetura:** o preview **não redesenha** o carimbo em HTML/CSS. Redesenhar
> significaria manter dois layouts (CSS e SVG) que precisam concordar em fonte, entrelinha e
> posição — a maior fonte de divergência do §13. Exibindo o SVG que o Sharp vai compor, o
> layout é literalmente o mesmo objeto; sobra apenas a diferença de rasterização.
> Medido nas fotos do Lito X1: **melhor alinhamento em dx=0, dy=0** (sem deslocamento) e, com
> um blur leve para tirar o anti-aliasing, diferença média de **2,8/255** — abaixo da diferença
> da própria foto reescalada pelos dois motores (4,9/255). O botão **Render (Sharp)** no editor
> troca o preview pelo arquivo real a qualquer momento para reconferir.

Camadas de interação por cima do SVG (a parte visual continua sendo o SVG):

- ✅ **Alças** (`DragBox`): retângulos transparentes nas caixas calculadas pela geometria
  compartilhada — `sectionBox` do `buildOverlaySvg` e `logoBox()`. Arrastar muda `{x,y}`;
  a bolinha do canto muda `widthPct`.
- ✅ **`FieldList`**: reordena os campos com `@dnd-kit` (reescreve a ordem de `section.fields`) e
  liga/desliga campo, ícone e rótulo. Mostra o valor real da foto atual em cada linha, e avisa
  quando a foto não tem aquele dado.
- ✅ **`InspectorPanel`**: largura da seção, fonte, entrelinha, margem interna, cores e
  opacidade do fundo, além da logo (escolher, largura, opacidade, remover). Cada controle
  relativo exibe o **px equivalente na foto atual**, que é o número que o usuário enxerga.

**Logo (RF-06):** o `Template` guarda só o `filePath`; quem carrega é o `logo.service`, que
**converte tudo para PNG** — inclusive SVG. Chromium e librsvg tratam SVG aninhado de formas
diferentes, então entregar o mesmo PNG aos dois lados mantém o preview igual à saída. Logo
ilegível não invalida o carimbo: sai sem ela (RNF-08).

> **`section.align` continua só `left`.** Centralizar/alinhar à direita exige saber a largura
> do texto para posicionar o ícone, e SVG 1.1 não mede texto — precisaria de métricas de fonte
> nos dois lados, com risco de preview ≠ saída. Fica para a Fase 2; o campo existe no tipo, mas
> o inspector não o expõe.

**Tema (RNF-09):** `lib/theme.ts` guarda o modo escolhido — **só `claro` ou `escuro`** — em
`localStorage` e escreve `data-theme` no `<html>`; o Tailwind usa esse atributo como
variante `dark:` (`@custom-variant` em `assets/main.css`). Nenhum componente do editor deve
fixar cor sem a variante escura. O **carimbo** não é afetado — suas cores vêm do `Template`.

> A variante usa `&:is([data-theme='dark'], …)`, **não** `:where()`. Com `:where()`
> (especificidade zero) o `dark:bg-slate-900/40` empata com `bg-white` e quem decide é a ordem
> do CSS gerado — na prática apareciam caixas brancas no tema escuro. O `:is()` dá à variante
> especificidade de atributo e ela vence sempre.

Estado do template em `state/useTemplate.ts` (`useState` por ora; Zustand quando o inspector
crescer). Toda mudança regenera o SVG e o preview atualiza na hora.

---

## 7. Modelo de coordenadas (o coração da fidelidade)

Problema: fotos têm resoluções diferentes; o preview tem outra escala ainda. Solução: **tudo relativo à largura da imagem**.

- Posições `x,y` ∈ [0,1] (fração da largura/altura).
- Tamanhos (`widthPct`, `fontPct`, `paddingPct`, `lineGapPct`) = fração da **largura** da imagem.
- No **preview**: `pxPreview = pct * larguraPreview`.
- No **Main/Sharp**: `pxReal = pct * larguraReal`.

Mesma fórmula nos dois lados (`shared/geometry.ts` → `sectionMetrics()`) ⇒ o carimbo ocupa a mesma proporção em qualquer resolução e o preview bate com o arquivo final. **Fonte relativa** também resolve o "texto minúsculo em foto de 4000px / gigante em 1080px".

Na prática o SVG é sempre gerado no **tamanho real da foto** (mesmo para o preview, que só o
escala). A altura da seção é **consequência** do conteúdo: `sectionMetrics()` recebe quantas
linhas entraram e devolve `height = linhas × entrelinha + 2 × padding`. Campos sem valor na
foto **não entram** no carimbo — por isso a caixa encolhe em foto sem GPS, em vez de deixar
buracos.

---

## 8. Persistência: perfis em JSON

N perfis = **um arquivo `.json` por perfil** em `profiles/` (a logo é referenciada por caminho, permitindo N logos). O arquivo é a serialização direta do tipo `Template` — a **ordem** do array `section.fields` já é a ordem vertical (o DnD só reordena esse array). Exemplo:

```json
{
  "name": "Padrão ENDEGRO",
  "section": {
    "x": 0.03, "y": 0.72,
    "widthPct": 0.28,
    "fontFamily": "Roboto",
    "fontPct": 0.020,
    "lineGapPct": 0.010,
    "paddingPct": 0.012,
    "bgColor": "#000000", "bgOpacity": 0.55,
    "textColor": "#FFFFFF",
    "align": "left",
    "fields": [
      { "key": "latitude",  "visible": true, "showIcon": true, "showLabel": true },
      { "key": "longitude", "visible": true, "showIcon": true, "showLabel": true },
      { "key": "altitude",  "visible": true, "showIcon": true, "showLabel": true },
      { "key": "date",      "visible": true, "showIcon": true, "showLabel": false },
      { "key": "time",      "visible": true, "showIcon": true, "showLabel": false },
      { "key": "model",     "visible": true, "showIcon": true, "showLabel": false }
    ]
  },
  "logo": {
    "filePath": "logos/endegro.png",
    "x": 0.82, "y": 0.86, "widthPct": 0.15, "opacity": 1.0
  }
}
```

`profile.service.ts` faz `JSON.parse/stringify` + **validação de esquema** (ex.: Zod) ao carregar, aplicando o perfil padrão (`template-defaults.ts`) a campos ausentes para compatibilidade entre versões.

---

## 9. Ícones dos metadados (Lucide, fixos por campo)

Mapeamento **fixo** `FieldKey → nome do ícone`, em `src/shared/field-icons.ts`:

```ts
export const FIELD_ICON: Record<FieldKey, string> = {
  latitude: 'map-pin', longitude: 'map-pin',
  altitude: 'mountain', date: 'calendar', time: 'clock',
  model: 'plane', direction: 'compass',
};
```

- **UI do app** (lista de metadados, chips de cobertura): `lucide-react` — `lib/field-icons.ts`.
- **Carimbo** (preview *e* saída): `lucide-static`. O Main importa os ícones do pacote
  (`services/icon-markup.ts`) e o Renderer os mesmos arquivos `.svg` via `?raw`
  (`lib/icon-markup.ts`); os dois passam pelo `extractIconMarkup()` compartilhado. Verificado:
  o markup gerado nos dois lados é **idêntico byte a byte**.

Como os dois lados usam a **mesma origem de ícones (Lucide)**, o preview bate com o arquivo final (RNF-05) — o que **emoji não garantiria** (renderiza diferente entre Windows e Sharp). Trocar ícone por campo fica para a Fase 2; no MVP o mapa é fixo (`showIcon` só liga/desliga).

### 9.1 Fonte (Roboto, offline)

`assets/fonts/roboto.ttf` é embarcada. No Renderer, carregada via `@font-face` local (nada de CDN — mantém offline). No Main, o `.ttf` é lido e **embutido em base64** dentro do SVG (`@font-face` no `<defs>`) para o Sharp desenhar o texto **idêntico** ao preview.

> **Pendente:** o arquivo `roboto.ttf` ainda não está no repo. Enquanto isso o SVG declara
> `'Roboto', sans-serif` e **os dois lados caem na mesma sans-serif do sistema** (na verificação
> em WSL, Chromium e librsvg escolheram a mesma). Ao adicionar a fonte, atenção: o
> `@font-face` embutido resolve o Chromium, mas o **librsvg usa fontconfig** — no empacotamento
> pode ser preciso apontar `FONTCONFIG_FILE` para uma conf que inclua `assets/fonts/`.

---

## 10. Pipeline de geração (Main, por foto)

```
foto + Template
   │
   ▼ exif.service      → PhotoMetadata (XMP drone-dji decimal p/ GPS/alt/yaw;
   │                      EXIF como fallback; ProductName p/ modelo)
   ▼ shared/format     → strings formatadas (decimal→DMS, data BR, "628,5 m", yaw→0..360°)
   │                      — mesmas funções que o preview usa (RNF-05)
   ▼ overlay-svg       → monta 1 SVG do tamanho REAL da foto:
   │                      seção (fundo, campos ordenados, ícones) + logo
   ▼ sharp             → carrega foto (auto-rotate EXIF),
   │                      composite([{svg}], ...), grava CÓPIA na saída
   ▼ batch.service     → emite progress; erro num arquivo não aborta o lote
```

Concorrência: `p-limit(nº núcleos - 1)`. Original nunca é tocado (RF-10); a saída sai com
`keepMetadata()`, então a cópia continua com EXIF/GPS.

**Medições nas fotos do Lito X1** (8064 × 4536, ~25 MB, WSL):

| Etapa | Tempo |
|-------|-------|
| `exif.service` (por foto) | ~38 ms |
| composite + JPEG q92 → arquivo | ~1,1 s (9,8 MB) |
| idem com `mozjpeg` | ~4,9 s (8,2 MB) → **descartado**, 4× mais lento por 15% de arquivo |
| `preview:render` (compõe real + reduz p/ 1400 px) | ~1,8 s |

⚠️ **Ordem das operações no Sharp:** `resize` é aplicado **antes** de `composite`,
independentemente da ordem das chamadas. Compor e reduzir no mesmo pipeline dá
`Image to composite must have same dimensions or smaller` — o `renderPreview` compõe em tamanho
real, extrai `raw()` e reduz num **segundo** `sharp()`.

---

## 11. Segurança / offline

- `contextIsolation: true`, `nodeIntegration: false`; FS/imagem só via IPC nomeado.
- **CSP** no Renderer bloqueando rede (`main/security.ts`): em produção `connect-src 'none'`; em dev libera o HMR do Vite.
- **DevTools/console desligados** (RNF-10): `webPreferences.devTools: false`, atalhos bloqueados em `main/shortcuts.ts` (F12, `Ctrl+Shift+I/J/C`, reload em produção, zoom) e `Menu.setApplicationMenu(null)`. Escape hatch de desenvolvimento: `FOTOGEO_DEVTOOLS=1 yarn dev`.
- Validar caminhos vindos do Renderer no Main.

---

## 12. Empacotamento (Windows)

> **Postergado:** o `electron-builder` não está no projeto por enquanto — o ciclo de
> desenvolvimento é só `yarn dev` até o MVP fechar (passo 8 do §14). O que retomar está em
> `REQUISITOS.md §11.5`.

- `electron-builder`: target **nsis** (instalador) e **portable** (`.exe` duplo clique).
- Empacotar binários win-x64 de `sharp` e `exiftool-vendored`; incluir `assets/icons`.
- Ícone + metadados do app; (opcional) assinatura p/ SmartScreen.

---

## 13. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| **Preview ≠ saída** (o maior risco) | ✅ Mitigado na raiz: **o preview exibe o próprio SVG da saída** (§6), gerado por código compartilhado. Verificado: alinhamento dx=0/dy=0 e diferença residual só de anti-aliasing. `preview:render` fica como conferência a qualquer momento. |
| GPS só no XMP (não no EXIF padrão) | `exif.service` **prioriza o namespace `drone-dji`** (GPS em decimal) e usa o EXIF como fallback; nunca depende só de `GPSImgDirection` (ausente na amostra). |
| Modelo exibido como `FC9589` | Usar `drone-dji:ProductName` (`Lito X1`); `Make`+`Model` só como fallback. |
| Arquivos grandes (~25 MB, 8064 px) em lote | `sharp` por streaming + `p-limit(núcleos-1)`; SVG do overlay dimensionado à largura real. |
| PNG/BMP sem EXIF de GPS (caso secundário) | Mostrar `present[]` por foto (RF-02); regra p/ ausência (a confirmar) — não é o fluxo principal. |
| Roboto diferente entre tela e Sharp | Embutir `roboto.ttf` em base64 (`@font-face`) no SVG usado pelo Sharp (§9.1). **Enquanto a fonte não entra**, os dois lados caem na sans-serif do sistema; o `librsvg` resolve fonte por **fontconfig**, então a Roboto embarcada exigirá conf própria no empacotamento. |
| `sharp` dentro do Electron no Linux | Aviso `[SharpElectronLinux]` + ruído de `GLib-GObject` no terminal do WSL (o binário do libvips convive com a GLib do Electron). Funciona, mas é barulhento; o alvo é Windows, onde não ocorre — `REQUISITOS.md §11.3`. |
| XMP DJI não lido | `exiftool-vendored`. |
| Módulos nativos no build | `electron-builder` + rebuild; testar `.exe` em Windows real. |
| Lote grande / memória | `p-limit` + Sharp por streaming. |

---

## 14. Ordem de implementação

> **Estado: 5 de 9 concluídos** (✅ pronto · ⬜ pendente). Este é o placar do projeto —
> atualizar aqui, no "Estado atual" da §3 e nas marcas do `REQUISITOS.md §4/§5` a cada
> passo fechado.

1. ✅ Esqueleto `electron-vite` (React+TS+Tailwind) + IPC básico.
2. ✅ `exif.service` + `photos:scan` → importar fotos reais do Lito X1 e **listar metadados**.
   Premissa validada nas 13 fotos da amostra: todos os 7 campos presentes em todas
   (~38 ms/foto), valores idênticos aos do §15 (`22°59'28.79"S`, `621,5 m`, `299,7°`, `Lito X1`).
3. ✅ `overlay-svg` + `render.service` → foto carimbada em tamanho real via Sharp
   (8064 × 4536 em ~1,1 s, EXIF preservado, original intacto).
4. ✅ `geometry` + `EditorCanvas` → preview fiel validado (§6/§7): mesmo SVG nos dois lados,
   alinhamento exato, seção arrastável e redimensionável.
5. ✅ Editor completo: campos com DnD (`@dnd-kit`), inspector (largura, fonte, espaçamentos,
   cores, rótulos, visibilidade) e logo PNG/SVG com posição/tamanho livres.
6. ⬜ `profile.service` (JSON + validação Zod) → salvar/carregar/duplicar perfis (N logos).
7. ⬜ `batch.service` → lote, progresso, resumo, preservar originais.
8. ⬜ `electron-builder` → `.exe` Windows e teste em máquina real.
9. ⬜ Fase 2 (mini mapa offline, direção, preenchimento manual, relatório).

---

## 15. Mapa de metadados — amostra real (DJI Lito X1 / `FC9589`)

Referência para `exif.service.ts`. Extraído das fotos em `drone/`. **Regra:** ler o XMP `drone-dji` primeiro; cair no EXIF quando ausente.

| `PhotoMetadata` | Fonte primária (XMP `drone-dji`) | Fallback (EXIF) | Exemplo real | Formatação (`format.util`) |
|-----------------|----------------------------------|-----------------|--------------|-----------------------------|
| `latitude` | `GpsLatitude` (decimal ±) | `GPSLatitude` (rational) + `GPSLatitudeRef` | `-22.991331444` | → DMS `22°59'28.79"S` |
| `longitude` | `GpsLongitude` (decimal ±) | `GPSLongitude` + `GPSLongitudeRef` | `-52.431268574` | → DMS `52°25'52.57"W` |
| `absoluteAltitude` | `AbsoluteAltitude` (`+621.504`) | `GPSAltitude` (`628.496`) | `+621.504` | `621,5 m` (BR) |
| `relativeAltitude` | `RelativeAltitude` (`+132.200`) | — | `+132.200` | `132,2 m` |
| `dateTimeOriginal` | `xmp:CreateDate` (`2026-07-18T15:57:12-03:00`) | `DateTimeOriginal`/`DateTime` (`2026:07:15 16:32:29`) | ISO c/ fuso | data `18/07/2026` · hora `15:57:12` |
| `direction` | `GimbalYawDegree` (`-60.30`) → fallback `FlightYawDegree` | `GPSImgDirection` (**ausente** na amostra) | `-60.30` | normalizar `((v%360)+360)%360` → `299,7°` |
| `droneModel` | `ProductName` (`Lito X1`) | `Make`+`Model` (`DJI FC9589`) | `Lito X1` | texto |
| `width`/`height` | — | SOF do JPEG | `8064 × 4536` | — |
| `photoNumber` | — | do nome do arquivo `…_0259_…` | `0259` | `#0259` (opcional) |

Outros tags presentes no XMP (não usados no MVP, úteis para Fase 2/diagnóstico): `GpsStatus`, `AltitudeType`, `GimbalPitchDegree`, `GimbalRollDegree`, `FlightPitch/Roll/YawDegree`, `SensorTemperature`, `CameraSerialNumber`, `ShutterType`, `WhiteBalanceCCT`.

> **Atenção:** valores XMP de altitude/ângulo vêm como **string com sinal** (`"+621.504"`, `"-60.30"`) → fazer `parseFloat`. GPS decimal já traz o sinal (S/W negativos) — a conversão para DMS deriva o hemisfério do sinal, dispensando `*Ref` quando se usa o XMP.
