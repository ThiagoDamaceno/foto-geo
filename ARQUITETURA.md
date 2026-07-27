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
| Perfis | **JSON** (`fs` + `JSON.parse/stringify`) + **`zod`** na leitura | Sem formato próprio; a validação é o que permite abrir perfil de versão antiga (ou editado à mão) sem quebrar o editor — §8. |
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
│   │       └── profile.service.ts     # JSON <-> Template: listar/carregar/gravar/duplicar/excluir (RF-07)
│   ├── preload/index.ts               # contextBridge (API segura)
│   ├── renderer/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ImportDropzone.tsx       # drag & drop + seletores (RF-01)
│   │   │   ├── MetadataList.tsx        # o que cada foto tem + cobertura do lote (RF-02)
│   │   │   ├── EditorCanvas.tsx        # foto + overlay SVG + alças (seção e logo)
│   │   │   ├── InspectorPanel.tsx      # largura, fonte, espaçamentos, cores, logo
│   │   │   ├── FieldList.tsx           # campos: reordenar (dnd-kit) e ligar/desligar
│   │   │   ├── ProfileBar.tsx          # escolher/salvar/duplicar/excluir perfil (RF-07)
│   │   │   ├── BatchPanel.tsx          # pasta de saída, naming, progresso e resumo (RF-09)
│   │   │   ├── ProgressBar.tsx         # barra do lote
│   │   │   └── ThemeToggle.tsx          # alterna claro ⇄ escuro (RNF-09)
│   │   ├── state/
│   │   │   ├── usePhotos.ts            # lote importado
│   │   │   ├── useProfiles.ts          # perfis salvos + "alterações não salvas"
│   │   │   ├── useBatch.ts             # pasta de saída + progresso/resumo do lote
│   │   │   └── useTemplate.ts          # template em edição + logo carregada
│   │   ├── lib/theme.ts                # tema: data-theme no <html> + localStorage
│   │   ├── lib/ipc-error.ts            # mensagem de erro IPC sem derrubar a UI
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
└── build/                              # ícones do app, config builder (só na fase de empacotamento — §12)
```

> **Estado atual (passos 1–7 do §14 concluídos):** esqueleto + IPC, import com leitura de
> telemetria, geração do carimbo (`shared/overlay-svg` + `render.service`), preview fiel, o
> **editor completo** — seção e logo arrastáveis/redimensionáveis, ordem dos campos por DnD e
> inspector — os **perfis em JSON** (`profile.service` + `ProfileBar`) e a **aplicação em lote**
> (`batch.service` + `BatchPanel`: pasta de saída, naming, progresso, cancelar, resumo).
> Falta o empacotamento `.exe` (passo 8). Pontos de atenção: §16. Instalação: `REQUISITOS.md §11`.
>
> Os perfis ficam em `profiles/` **ao lado do executável** (app portátil); em dev, na
> raiz do repositório — §8.
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
export interface DividerConfig { type: 'divider'; id: string; visible: boolean; }
export type SectionItem = FieldConfig | DividerConfig;  // divisor = linha horizontal no card

export interface SectionConfig {
  // posição/tamanho RELATIVOS à imagem (0..1) — independe da resolução
  x: number;               // 0..1 (borda esquerda da seção)
  y: number;               // 0..1 (borda superior da seção)
  widthPct: number;        // largura da seção / largura da imagem
  fontFamily: string;      // "Roboto" (embarcada)
  fontPct: number;         // altura da fonte / largura da imagem
  lineGapPct: number;      // espaçamento entre linhas
  paddingPct: number;
  radiusPct: number;       // raio dos cantos do card / largura da imagem (0 = reto)
  showBorder: boolean;     // contorno na cor do texto, mesma espessura do divisor
  bgColor: string;         // ex. "#000000"
  bgOpacity: number;       // 0..1
  textColor: string;
  align: 'left' | 'center' | 'right';
  fields: SectionItem[];   // ORDEM = ordem vertical (campos + divisores; DnD)
}

export interface LogoConfig {
  id: string;
  filePath: string;        // PNG/SVG/WebP/JPEG…
  x: number; y: number;    // 0..1 (livre)
  widthPct: number;        // largura relativa
  opacity: number;
}

export interface Template {          // == 1 PERFIL
  name: string;
  section: SectionConfig;
  logos: LogoConfig[];     // ORDEM = empilhamento (0 = frente); DnD na lista
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

// perfis (§8): o `id` é o nome do arquivo, e o `name` é só rótulo
export interface ProfileSummary { id: string; name: string; filePath: string;
  updatedAt: string; error?: string; }          // `error` = arquivo ilegível (RNF-08)
export interface ProfileFile { id: string; template: Template;
  logos: LogoAsset[]; warnings: string[]; } // logos alinhadas a template.logos; avisos = padrão / arquivo ausente

export type OutputNaming = 'keep' | 'suffix'   // §9.2: manter nome · ou acrescentar `_geo`
export interface BatchConfig {
  photos: string[]; outputDir: string; template: Template;
  naming: OutputNaming; overwrite: boolean;    // overwrite=false → ignora se já existe
}
export interface JobProgress { total: number; processed: number; currentFile: string;
  succeeded: number; skipped: number; failed: number; }
export interface BatchIssue { file: string; reason: string; skipped: boolean; }
export interface JobResult  { total: number; succeeded: number; skipped: number;
  failed: number; outputDir: string; canceled: boolean; elapsedMs: number;
  issues: BatchIssue[]; }                      // sem canal `batch:done`: o resumo volta no invoke
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
| `profiles:list` / `profiles:load` / `profiles:save` / `profiles:duplicate` / `profiles:delete` | R→M invoke | ✅ CRUD de perfis `.json` (§8). `load` devolve o template validado, a logo já em PNG e os avisos; `save` com `id` nulo cria arquivo novo. |
| `logo:pick` | R→M invoke | ✅ Selecionar uma ou mais logos → `LogoAsset[]` (PNG + proporção). |
| `logo:read` | R→M invoke | ✅ Recarregar uma logo já referenciada por um perfil (cache por mtime). |
| `dialog:pickOutputDir` | R→M invoke | ✅ Pasta de saída do lote (`null` se cancelar). |
| `batch:start` / `batch:cancel` | R→M invoke | ✅ Rodar/cancelar lote. `start` **resolve com `JobResult`** (não há `batch:done`). |
| `batch:progress` | M→R send | ✅ Único canal push do app: barra de andamento. |
| `shell:openPath` | R→M invoke | ✅ Abrir pasta de saída — **só diretório** (arquivo seria executado pelo SO). |

API no preload: `window.fotoGeo = { …, pickOutputDir, startBatch, cancelBatch, openPath, onBatchProgress }`.

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
> da própria foto reescalada pelos dois motores (4,9/255). O botão **Visualizar** no editor
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
- Tamanhos (`widthPct`, `fontPct`, `paddingPct`, `lineGapPct`, `radiusPct`) = fração da **largura** da imagem.
- No **preview**: `pxPreview = pct * larguraPreview`.
- No **Main/Sharp**: `pxReal = pct * larguraReal`.

Mesma fórmula nos dois lados (`shared/geometry.ts` → `sectionMetrics()`) ⇒ o carimbo ocupa a mesma proporção em qualquer resolução e o preview bate com o arquivo final. **Fonte relativa** também resolve o "texto minúsculo em foto de 4000px / gigante em 1080px".

Na prática o SVG é sempre gerado no **tamanho real da foto** (mesmo para o preview, que só o
escala). A altura da seção é **consequência** do conteúdo: `sectionMetrics()` recebe quantas
linhas entraram e devolve `height = linhas × entrelinha + 2 × padding`. Campos sem valor na
foto **não entram** no carimbo — por isso a caixa encolhe em foto sem GPS, em vez de deixar
buracos.

---

## 8. Persistência: perfis em JSON  ✅ (RF-07)

N perfis = **um arquivo `.json` por perfil**, e a logo é **referenciada por caminho** — daí os N perfis com N logos. O arquivo é a serialização direta do tipo `Template` (mais um `version`); a **ordem** do array `section.fields` já é a ordem vertical (o DnD só reordena esse array). Exemplo do que é gravado:

```json
{
  "version": 1,
  "name": "Obra São João",
  "section": {
    "x": 0.03, "y": 0.72,
    "widthPct": 0.28,
    "fontFamily": "Roboto",
    "fontPct": 0.020,
    "lineGapPct": 0.010,
    "paddingPct": 0.012,
    "radiusPct": 0.005,
    "showBorder": false,
    "bgColor": "#000000", "bgOpacity": 0.55,
    "textColor": "#FFFFFF",
    "align": "left",
    "fields": [
      { "key": "latitude",  "visible": true, "showIcon": true, "showLabel": true },
      { "key": "longitude", "visible": true, "showIcon": true, "showLabel": true },
      { "key": "altitude",  "visible": true, "showIcon": true, "showLabel": true },
      { "key": "date",      "visible": true, "showIcon": true, "showLabel": false },
      { "key": "time",      "visible": true, "showIcon": true, "showLabel": false },
      { "key": "model",     "visible": true, "showIcon": true, "showLabel": false },
      { "key": "direction", "visible": true, "showIcon": true, "showLabel": false }
    ]
  },
  "logos": [
    {
      "id": "logo-1",
      "filePath": "C:/Users/thiago/logos/endegro.png",
      "x": 0.82, "y": 0.86, "widthPct": 0.15, "opacity": 1.0
    }
  ]
}
```

**Onde ficam.** Em `profiles/` **ao lado do executável** (modo portátil). Em desenvolvimento, a mesma pasta na raiz do repositório. Se a pasta do exe não for gravável (ex.: Program Files), cai em `userData/profiles`. O portable do electron-builder usa `PORTABLE_EXECUTABLE_DIR`. Logos sob a raiz do app são gravadas com caminho **relativo**; arquivo ausente gera aviso e o path permanece no JSON.

**Identidade.** O perfil é identificado pelo **nome do arquivo** (`id`), gerado do nome na primeira gravação (`Obra São João` → `obra-sao-joao.json`), com sufixo numérico quando já existe. Consequência de projeto: **renomear e salvar não cria arquivo novo** — para isso existe o "Salvar como novo". O `id` que vem do Renderer é validado contra `/^[a-z0-9][a-z0-9-]{0,60}$/` antes de virar caminho, o que barra `../` (§11).

**Dois botões parecidos, de propósito:** o "Padrão" do inspector zera o carimbo **continuando no perfil aberto** (salvar depois sobrescreve aquele perfil), enquanto o "Novo (padrão)" da barra zera o carimbo **e sai do perfil** — o próximo salvar cria arquivo novo.

**Validação (`zod`).** Ao carregar, cada propriedade é validada isoladamente contra os **mesmos limites do inspector**:

- valor **inválido** → cai no padrão (`template-defaults.ts`) e gera **aviso na tela** (`Seção · cor de fundo: valor inválido (preto) — padrão aplicado.`);
- valor **ausente** → cai no padrão em silêncio (é o caso de perfil salvo por versão anterior);
- `fields`: a ordem do arquivo é preservada, chave desconhecida ou repetida sai, campo que falta entra no fim — assim um campo novo em versão futura aparece sem invalidar o perfil;
- **JSON corrompido** não some da lista: o perfil aparece marcado como "(ilegível)" e os outros abrem normalmente (RNF-08).

**Logo.** No `load` o Main já resolve a logo para PNG (`logo.service`) e devolve junto. Arquivo movido/apagado vira aviso e o perfil abre sem logo — mas **o caminho continua no perfil**, porque pode ser um drive desconectado e apagar a referência sozinho perderia a configuração do usuário.

**Gravação.** `writeFile` num `.tmp` + `rename`: um travamento no meio não deixa um `.json` pela metade.

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

Concorrência: `p-limit(min(núcleos − 1, 4))` — o teto **4** existe porque cada composição de
36 MP mantém ~150 MB em memória; acima disso o ganho some e o risco de OOM sobe (RNF-06).
Original nunca é tocado (RF-10): a pasta de saída **não pode** ser a das fotos de entrada.
A saída sai com `keepMetadata()`, então a cópia continua com EXIF/GPS. Nome dos arquivos:
`keep` (padrão) ou sufixo `_geo`; extensão sempre `.jpg`.

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
| Arquivos grandes (~25 MB, 8064 px) em lote | `sharp` + `p-limit` com **teto 4** (memória ~150 MB/foto); SVG do overlay na largura real. |
| Perfil de versão antiga (ou editado à mão) deixar o editor num estado impossível | Validação por propriedade com `zod` na leitura, com os limites do inspector: inválido cai no padrão **e avisa na tela**, ausente cai no padrão em silêncio (§8). JSON corrompido aparece na lista como "(ilegível)" em vez de derrubar a lista. |
| PNG/BMP sem EXIF de GPS (caso secundário) | Mostrar `present[]` por foto (RF-02); regra p/ ausência (a confirmar) — não é o fluxo principal. |
| Roboto diferente entre tela e Sharp | Embutir `roboto.ttf` em base64 (`@font-face`) no SVG usado pelo Sharp (§9.1). **Enquanto a fonte não entra**, os dois lados caem na sans-serif do sistema; o `librsvg` resolve fonte por **fontconfig**, então a Roboto embarcada exigirá conf própria no empacotamento. |
| `sharp` dentro do Electron no Linux | Aviso `[SharpElectronLinux]` + ruído `GLib-GObject`. Em lote paralelo o processo pode **SIGTRAP** (signal 5) e o app some. Mitigação: no Linux o lote roda **1 foto por vez** e `sharp.concurrency(1)`. Alvo é Windows — `REQUISITOS.md §11.3`. |
| XMP DJI não lido | `exiftool-vendored`. |
| Módulos nativos no build | `electron-builder` + rebuild; testar `.exe` em Windows real. |
| Lote grande / memória | `p-limit` teto 4 + um lote por vez (segundo `batch:start` é recusado). |

---

## 14. Ordem de implementação

> **Estado: 7 de 9 concluídos** (✅ pronto · ⬜ pendente). Este é o placar do projeto —
> atualizar aqui, no "Estado atual" da §3, nas marcas do `REQUISITOS.md §4/§5` e no §16
> a cada passo fechado.

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
6. ✅ `profile.service` (JSON + validação Zod) → salvar/abrir/duplicar/excluir perfis em
   `profiles/` (ao lado do exe), cada um com sua logo, e `ProfileBar` com marca de "alterações não
   salvas". Verificado: perfil de versão antiga e JSON corrompido abrem com aviso em vez de
   quebrar, e `id` com `../` é recusado.
7. ✅ `batch.service` → lote com `p-limit` (teto 4), progresso, cancelar, resumo
   (sucesso/ignoradas/erro), naming `keep`/`suffix`, pasta de saída ≠ origem. Verificado:
   42 checagens no serviço (originais intactos, colisão de nome, foto ruim não aborta,
   cancelar no meio, segundo lote recusado, `openPath` só em diretório).
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

---

## 16. Pontos de atenção do projeto

Checklist vivo do que **não pode ser esquecido** ao mexer no código ou no empacotamento.
Complementa a tabela de riscos (§13); aqui o foco é operacional.

### Produto / dados
- **Original intocável (RF-10):** a pasta de saída **nunca** pode ser a das fotos de entrada —
  o `batch.service` recusa antes de gravar. Qualquer atalho novo de “salvar em cima” quebra o
  contrato.
- **Preview = saída (RNF-05):** um único SVG (`shared/overlay-svg.ts`). Não redesenhar o
  carimbo em HTML/CSS no Renderer.
- **Coords relativas (RNF-04):** posições/tamanhos em fração 0–1 da foto. Fotos da amostra são
  8064×4536; template tem que funcionar em outras resoluções sem retocar.
- **Campo sem valor não entra no carimbo:** a caixa encolhe. Foto sem telemetria e sem logo é
  **ignorada** no lote (não vira recompressão muda).
- **Nome de saída (§9.2):** padrão `keep` (mesmo nome, outra pasta); opção `suffix` → `_geo`.
  Extensão **sempre `.jpg`** — entrada PNG/BMP também sai JPEG.
- **Perfis = arquivo, não rótulo:** o `id` é o nome do `.json`; renomear e salvar **não** cria
  outro. “Salvar como novo” / “Duplicar” existem para isso. Gravação em `.tmp` + rename.
- **Logo por caminho:** N perfis = N logos. Logo ausente (drive desconectado) vira **aviso**,
  mas o caminho permanece no JSON.

### Main / IPC / segurança
- **Caminhos do Renderer são hostis** (§11): validar extensão, existência e (no caso de
  perfil) regex do `id` antes de virar path. `shell:openPath` só aceita **diretório**.
- **Um único canal push:** `batch:progress`. O resumo do lote volta no **mesmo** `invoke` de
  `batch:start` — não reintroduzir `batch:done` (dois caminhos dessincronizam a UI).
- **Um lote por vez:** segundo `batch:start` é recusado. Cancelar marca flag; o que já
  começou termina (cópias parciais ficam na pasta).
- **Colisão de nome no Windows:** comparar saída em minúsculas (`foto.JPG` ≡ `foto.jpg`).
  Planejar o mapa de saídas **antes** de gravar, senão duas fotos do lote se sobrescrevem.
- **Sem console para o usuário (RNF-10):** nenhuma exceção pode escapar do Renderer — a
  janela fica branca. Hooks (`useBatch`, `useProfiles`, …) engolem e mostram na UI.
- **Offline (RNF-01):** CSP bloqueia rede em produção. Não adicionar fetch “só pra telemetria”.

### Desempenho / empacotamento (passo 8)
- **Teto de concorrência = 4 no Windows**, **1 no Linux/WSL**: no WSL o Electron+Sharp
  costuma morrer com SIGTRAP se processar várias 36 MP em paralelo. Os `GLib-GObject` no
  terminal **não** são o crash — o crash é o processo sumir (`Done in …s`).
- **Ordem no Sharp:** `resize` roda **antes** de `composite` independentemente da ordem das
  chamadas. Compor e reduzir no mesmo pipeline quebra — o `renderPreview` usa dois `sharp()`.
- **`roboto.ttf` ainda não está no repo:** os dois lados caem na sans-serif do sistema.
  Quando entrar, o Chromium resolve via `@font-face` no SVG, mas o **librsvg usa fontconfig**
  — no `.exe` pode ser preciso `FONTCONFIG_FILE` apontando para `assets/fonts/`.
- **Binários nativos:** `sharp` e `exiftool-vendored` precisam dos builds **win-x64** no
  empacotamento; o `node_modules` do WSL **não** serve no Windows (e o inverso também).
- **WSL ≠ produto:** DnD do Explorer não chega no WSLg; GPU desligada no Linux. O spam
  `GLib-GObject` / `SharpElectronLinux` é conflito Electron↔sharp (sem fix no app); o
  `yarn dev` filtra no Linux (`scripts/dev.mjs`). Validar DnD e o `.exe` no Windows.
- **Harnesses Electron no Cursor/WSL:** a sessão injeta `ELECTRON_RUN_AS_NODE=1` — scripts
  descartáveis precisam de `env -u ELECTRON_RUN_AS_NODE electron --no-sandbox …`. Não
  versionar esses probes.
