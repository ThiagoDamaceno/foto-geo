/**
 * Tipos compartilhados entre Main, Preload e Renderer.
 * Ver ARQUITETURA.md §4 — este arquivo cresce com Template/Batch etc.
 */

/** Versões do runtime, exibidas na tela inicial (diagnóstico). */
export interface AppInfo {
  appName: string
  appVersion: string
  electron: string
  chrome: string
  node: string
  platform: NodeJS.Platform
  isPackaged: boolean
}

/** Campos de telemetria carimbáveis — sempre estes (REQUISITOS.md §3). */
export type FieldKey =
  | 'latitude'
  | 'longitude'
  | 'altitude'
  | 'date'
  | 'time'
  | 'model'
  | 'direction'

/**
 * Telemetria de uma foto, lida no import (RF-02).
 * GPS/altitude/direção vêm do XMP `drone-dji` com EXIF como fallback (ARQUITETURA.md §15).
 */
export interface PhotoMetadata {
  filePath: string
  fileName: string
  /** Bytes do arquivo original (informativo na lista). */
  fileSize: number
  width: number
  height: number
  /** Graus decimais com sinal (S/W negativos). */
  latitude?: number
  longitude?: number
  /** Metros acima do nível do mar — padrão do carimbo. */
  absoluteAltitude?: number
  /** Metros em relação ao ponto de decolagem. */
  relativeAltitude?: number
  /** ISO com fuso da câmera, ex. `2026-07-18T15:56:23-03:00`. */
  dateTimeOriginal?: string
  /** Rumo normalizado 0..360 (gimbal yaw). */
  direction?: number
  /** Nome amigável (`Lito X1`), não o código do sensor. */
  droneModel?: string
  /** Nº sequencial extraído do nome do arquivo (`…_0253_…`). */
  photoNumber?: string
  /** Campos com valor nesta foto (RF-02). */
  present: FieldKey[]
  /** Preenchido quando a leitura falhou — a foto entra na lista marcada com erro (RNF-08). */
  error?: string
}

/** Resultado do `photos:scan`. */
export interface ScanResult {
  photos: PhotoMetadata[]
  /** Caminhos recusados antes da leitura (extensão não suportada, arquivo inacessível). */
  ignored: { filePath: string; reason: string }[]
}

/** Um campo dentro da seção. O ícone é fixo (`field-icons.ts`); aqui só liga/desliga. */
export interface FieldConfig {
  key: FieldKey
  visible: boolean
  showIcon: boolean
  showLabel: boolean
}

/**
 * Seção de dados. Posições e tamanhos são **relativos** (ARQUITETURA.md §7):
 * `x`/`y` em fração da largura/altura da imagem; o resto em fração da **largura**.
 */
export interface SectionConfig {
  x: number
  y: number
  widthPct: number
  fontFamily: string
  fontPct: number
  lineGapPct: number
  paddingPct: number
  bgColor: string
  bgOpacity: number
  textColor: string
  align: 'left' | 'center' | 'right'
  /** A ORDEM deste array é a ordem vertical (o DnD reordena isto). */
  fields: FieldConfig[]
}

/** Logo com posição e tamanho livres. */
export interface LogoConfig {
  filePath: string | null
  x: number
  y: number
  widthPct: number
  opacity: number
}

/** Um perfil completo — é isto que vai para o `.json` (ARQUITETURA.md §8). */
export interface Template {
  name: string
  section: SectionConfig
  logo: LogoConfig
}

/**
 * Logo carregada e pronta para o carimbo.
 *
 * O Main **sempre converte para PNG** (mesmo quando a origem é SVG): o Chromium e o librsvg
 * não tratam SVG aninhado do mesmo jeito, e um PNG idêntico nos dois lados mantém o preview
 * igual à saída (RNF-05). O `Template` guarda só o `filePath` (ARQUITETURA.md §8).
 */
export interface LogoAsset {
  filePath: string
  /** `data:image/png;base64,…` */
  dataUrl: string
  /** largura/altura — define a altura da caixa a partir da largura relativa. */
  aspectRatio: number
}

/** Imagem já reduzida para exibição no editor (o original tem ~36 MP). */
export interface PreviewImage {
  /** `data:image/jpeg;base64,…` */
  dataUrl: string
  /** Dimensões da imagem reduzida. */
  width: number
  height: number
  /** Dimensões reais da foto (base do modelo relativo). */
  sourceWidth: number
  sourceHeight: number
}

/** Render de conferência: a saída do Sharp, reduzida só para caber na tela. */
export interface RenderedPreview extends PreviewImage {
  /** Tempo do render em tamanho real, em ms (referência para o lote — RNF-06). */
  elapsedMs: number
}

/** API exposta pelo preload em `window.fotoGeo` (ARQUITETURA.md §5). */
export interface FotoGeoApi {
  /** Sanity check do canal IPC: devolve `'pong'`. */
  ping: () => Promise<string>
  getAppInfo: () => Promise<AppInfo>
  /** Seletor de arquivos de imagem; `[]` se o usuário cancelar. */
  pickImages: () => Promise<string[]>
  /** Seletor de pasta: devolve as imagens encontradas dentro dela. */
  pickFolder: () => Promise<string[]>
  /** Lê a telemetria dos caminhos informados (arquivos e/ou pastas). */
  scanPhotos: (paths: string[]) => Promise<ScanResult>
  /** Versão reduzida da foto para o fundo do editor. */
  getPreviewImage: (filePath: string, maxWidth: number) => Promise<PreviewImage>
  /** Seletor de logo (PNG/SVG); `null` se o usuário cancelar. */
  pickLogo: () => Promise<LogoAsset | null>
  /** Recarrega uma logo já referenciada por um perfil. */
  readLogo: (filePath: string) => Promise<LogoAsset>
  /** Carimba a foto em tamanho real com o Sharp e devolve o resultado reduzido. */
  renderPreview: (
    photo: PhotoMetadata,
    template: Template,
    maxWidth: number
  ) => Promise<RenderedPreview>
}
