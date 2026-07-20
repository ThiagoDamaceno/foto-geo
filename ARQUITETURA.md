# Arquitetura Base — Foto Geo (Electron + React + TS + Tailwind + Vite)

> **Documento de arquitetura — v2.** Complementa `REQUISITOS.md`.
> App **desktop Windows offline**: editor visual de template de telemetria + aplicação em lote, com perfis em `.ini`.

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
│  │    seção, campos (DnD),        │    │  • Perfis .ini (ler/   │  │
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
                       imagens de entrada · perfis .ini · logos · saída
```

**Regra de ouro:** o **template** (config) é a fonte única. O Renderer o edita e o **desenha em HTML/CSS** para preview; o Main **reproduz o mesmo template** com Sharp/SVG para o arquivo final. Ambos usam o **mesmo modelo de coordenadas relativas** (§7) → preview = saída.

---

## 2. Stack

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Shell | **Electron** | `.exe` Windows offline. |
| UI | **React + TypeScript** | Requisito. |
| Estilo | **Tailwind CSS** | Requisito; agiliza o layout do editor. |
| Dev/build | **electron-vite** + **Vite** | Template Electron+React+TS pronto, HMR. |
| EXIF/XMP | **`exiftool-vendored`** | Lê XMP DJI (altitude/yaw); binário offline. |
| Render imagem | **`sharp`** (libvips) | Composição rápida em lote; SVG→imagem. |
| Overlay | **SVG dinâmico** | Texto/ícones escaláveis; base do "espelhamento". |
| Ícones | **`lucide-react`** (UI) + **`lucide-static`** (SVG p/ o Sharp) | Mesmos ícones nos dois lados → fidelidade. |
| Fonte | **Roboto** (arquivo `.ttf` local, embarcado) | Offline; embutida em base64 no SVG do render. |
| Drag & drop (reordenar campos) | **`@dnd-kit`** | Leve, acessível, TS-first. |
| Drag livre (seção/logo no canvas) | Ponteiro + coords relativas (custom) ou `react-rnd` | Mover/redimensionar sobre o preview. |
| Perfis | **JSON** (`fs` + `JSON.parse/stringify`) | Sem lib extra; suporta listas/aninhamento nativamente. |
| Concorrência lote | **`p-limit`** | Limita imagens simultâneas. |
| Empacotar | **`electron-builder`** | NSIS + portátil Windows. |

> Módulos nativos (`sharp`, `exiftool-vendored`): empacotar binários **win-x64** via `electron-builder` (+ rebuild p/ a versão do Electron).

---

## 3. Estrutura de pastas

```
foto-geo/
├── electron.vite.config.ts
├── package.json / tsconfig.json / tailwind.config.js
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── ipc/handlers.ts
│   │   └── services/
│   │       ├── exif.service.ts        # EXIF/XMP → PhotoMetadata
│   │       ├── render.service.ts      # template + foto → SVG → Sharp → arquivo
│   │       ├── overlay-svg.ts         # gera o SVG (seção + ícones + logo)
│   │       ├── batch.service.ts       # lote, progresso, concorrência
│   │       ├── profile.service.ts     # JSON <-> Template (ler/gravar/listar)
│   │       └── format.util.ts         # DMS, data BR, altitude…
│   ├── preload/index.ts               # contextBridge (API segura)
│   ├── renderer/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ImportDropzone.tsx
│   │   │   ├── MetadataList.tsx        # o que cada foto tem
│   │   │   ├── EditorCanvas.tsx        # preview + elementos arrastáveis
│   │   │   ├── SectionElement.tsx      # a seção sobre a imagem
│   │   │   ├── LogoElement.tsx         # logo livre
│   │   │   ├── FieldList.tsx           # campos + reordenar (dnd-kit)
│   │   │   ├── FieldRow.tsx            # ícone + rótulo/valor
│   │   │   ├── InspectorPanel.tsx      # fonte, tamanho, ícones, posição
│   │   │   ├── ProfileBar.tsx          # escolher/salvar/duplicar perfil
│   │   │   ├── ProgressBar.tsx / SummaryPanel.tsx
│   │   ├── state/                      # store do template (Zustand ou Context)
│   │   └── lib/geometry.ts            # coords relativas <-> px (mesmo cálculo do Main)
│   └── shared/
│       ├── types.ts                    # Template, PhotoMetadata, etc.
│       ├── field-icons.ts             # mapa fixo FieldKey -> nome do ícone Lucide
│       └── template-defaults.ts        # perfil padrão
├── assets/fonts/roboto.ttf             # fonte embarcada (offline)
├── profiles/                           # perfis .json + logos do usuário
└── build/                              # ícones do app, config builder
```

---

## 4. O modelo central: `Template`

Fonte única de verdade, compartilhada Main⇄Renderer e serializada em `.ini`.

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
  width: number; height: number;
  latitude?: number; longitude?: number; altitude?: number;
  dateTimeOriginal?: string; direction?: number; droneModel?: string;
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
| `dialog:pickImages` / `dialog:pickFolder` | R→M invoke | Selecionar imagens/pasta. |
| `photos:scan` | R→M invoke | Extrai `PhotoMetadata[]` (com `present`). |
| `preview:render` | R→M invoke | (Opcional) render de 1 foto p/ conferência pixel-perfect. |
| `profiles:list` / `profiles:load` / `profiles:save` / `profiles:duplicate` | R→M invoke | CRUD de perfis `.ini`. |
| `logo:pick` | R→M invoke | Selecionar PNG/SVG da logo. |
| `batch:start` / `batch:cancel` | R→M invoke | Rodar/cancelar lote. |
| `batch:progress` / `batch:done` | M→R send | `JobProgress` / `JobResult`. |
| `shell:openPath` | R→M invoke | Abrir pasta de saída. |

API no preload: `window.fotoGeo = { pickImages, scanPhotos, renderPreview, listProfiles, loadProfile, saveProfile, pickLogo, startBatch, cancelBatch, openPath, onProgress, onDone }`.

---

## 6. Editor WYSIWYG (Renderer)

`EditorCanvas` = imagem de fundo (uma foto do lote) + camadas absolutas:

- **`SectionElement`**: posicionada/dimensionada a partir de `section.{x,y,widthPct}` convertidos para px do preview via `lib/geometry.ts`. Arrastável (muda `x,y`), redimensionável (muda `widthPct`).
- **`FieldList`** dentro da seção: cada campo é uma linha (`FieldRow`) com ícone + valor **real** da foto atual. **Reordenar com `@dnd-kit`** → reescreve a ordem do array `section.fields`.
- **`LogoElement`**: livre; arrastar muda `logo.{x,y}`, alça muda `widthPct`.
- **`InspectorPanel`**: controles de fonte (`fontPct`), tamanho da seção, cores/opacidade, e por campo: visível, `iconId` (via `IconPicker`), rótulo.

Estado do template num store (Zustand recomendado). Toda mudança atualiza o preview instantaneamente. **O preview usa exatamente os mesmos números relativos** que o Main usará ao gerar — é isso que garante a fidelidade (RNF-05).

---

## 7. Modelo de coordenadas (o coração da fidelidade)

Problema: fotos têm resoluções diferentes; o preview tem outra escala ainda. Solução: **tudo relativo à largura da imagem**.

- Posições `x,y` ∈ [0,1] (fração da largura/altura).
- Tamanhos (`widthPct`, `fontPct`, `paddingPct`, `lineGapPct`) = fração da **largura** da imagem.
- No **preview**: `pxPreview = pct * larguraPreview`.
- No **Main/Sharp**: `pxReal = pct * larguraReal`.

Mesma fórmula nos dois lados (compartilhada em `shared`/`lib/geometry.ts`) ⇒ o carimbo ocupa a mesma proporção em qualquer resolução e o preview bate com o arquivo final. **Fonte relativa** também resolve o "texto minúsculo em foto de 4000px / gigante em 1080px".

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

- **No Renderer/preview:** `lucide-react` (`<Icon name={FIELD_ICON[key]} />`).
- **No Main/render final:** os **mesmos ícones** via `lucide-static` (SVG cru), embutidos no SVG que o Sharp compõe.

Como os dois lados usam a **mesma origem de ícones (Lucide)**, o preview bate com o arquivo final (RNF-05) — o que **emoji não garantiria** (renderiza diferente entre Windows e Sharp). Trocar ícone por campo fica para a Fase 2; no MVP o mapa é fixo (`showIcon` só liga/desliga).

### 9.1 Fonte (Roboto, offline)

`assets/fonts/roboto.ttf` é embarcada. No Renderer, carregada via `@font-face` local (nada de CDN — mantém offline). No Main, o `.ttf` é lido e **embutido em base64** dentro do SVG (`@font-face` no `<defs>`) para o Sharp desenhar o texto **idêntico** ao preview.

---

## 10. Pipeline de geração (Main, por foto)

```
foto + Template
   │
   ▼ exif.service      → PhotoMetadata (valores reais)
   ▼ format.util       → strings formatadas (DMS, data BR, "628,5 m")
   ▼ overlay-svg       → monta 1 SVG do tamanho REAL da foto:
   │                      seção (fundo, campos ordenados, ícones) + logo
   ▼ sharp             → carrega foto (auto-rotate EXIF),
   │                      composite([{svg}], ...), grava CÓPIA na saída
   ▼ batch.service     → emite progress; erro num arquivo não aborta o lote
```

Concorrência: `p-limit(nº núcleos - 1)`. Original nunca é tocado (RF-10).

---

## 11. Segurança / offline

- `contextIsolation: true`, `nodeIntegration: false`; FS/imagem só via IPC nomeado.
- **CSP** no Renderer bloqueando rede; nenhuma dependência do núcleo exige internet.
- Validar caminhos vindos do Renderer no Main.

---

## 12. Empacotamento (Windows)

- `electron-builder`: target **nsis** (instalador) e **portable** (`.exe` duplo clique).
- Empacotar binários win-x64 de `sharp` e `exiftool-vendored`; incluir `assets/icons`.
- Ícone + metadados do app; (opcional) assinatura p/ SmartScreen.

---

## 13. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| **Preview ≠ saída** (o maior risco) | Modelo de coords relativas único (§7) + ícones Lucide nos dois lados (§9) + Roboto embutida no SVG; opção `preview:render` p/ conferir pixel-perfect. |
| PNG/BMP sem EXIF de GPS | Mostrar `present[]` por foto (RF-02); regra p/ ausência (a confirmar). |
| Roboto diferente entre tela e Sharp | Embutir `roboto.ttf` em base64 (`@font-face`) no SVG usado pelo Sharp (§9.1). |
| XMP DJI não lido | `exiftool-vendored`. |
| Módulos nativos no build | `electron-builder` + rebuild; testar `.exe` em Windows real. |
| Lote grande / memória | `p-limit` + Sharp por streaming. |

---

## 14. Ordem de implementação

1. Esqueleto `electron-vite` (React+TS+Tailwind) + IPC básico.
2. `exif.service` + `photos:scan` → importar fotos reais do Lito X1 e **listar metadados** (valida a premissa).
3. `overlay-svg` + `render.service` → gerar 1 foto carimbada (seção fixa) via Sharp.
4. `lib/geometry.ts` + `EditorCanvas` → preview batendo com a saída (validar §7).
5. Editor completo: seção arrastável/redimensionável, campos com DnD, inspector (fonte/tamanho/ícones), logo livre.
6. `profile.service` (JSON + validação Zod) → salvar/carregar/duplicar perfis (N logos).
7. `batch.service` → lote, progresso, resumo, preservar originais.
8. `electron-builder` → `.exe` Windows e teste em máquina real.
9. Fase 2 (mini mapa offline, direção, preenchimento manual, relatório).
