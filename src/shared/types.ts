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
 * Linha divisória horizontal no carimbo (100% da largura útil — entre os paddings).
 * `id` estável para o DnD; vários divisores podem coexistir.
 */
export interface DividerConfig {
  type: 'divider'
  id: string
  visible: boolean
}

/** Item da lista ordenada da seção: campo de telemetria ou divisor. */
export type SectionItem = FieldConfig | DividerConfig

/** Discriminante: divisor tem `type: 'divider'`; campo antigo/novo não traz `type`. */
export function isDivider(item: SectionItem): item is DividerConfig {
  return (item as DividerConfig).type === 'divider'
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
  /** Raio dos cantos do card / largura da imagem (0 = retângulo). */
  radiusPct: number
  bgColor: string
  bgOpacity: number
  textColor: string
  align: 'left' | 'center' | 'right'
  /** A ORDEM deste array é a ordem vertical (o DnD reordena isto). */
  fields: SectionItem[]
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
 * Perfil salvo, como aparece na lista do editor (RF-07).
 * O `id` é o nome do arquivo sem `.json` — é ele que identifica o perfil, não o `name`,
 * para que renomear não crie um arquivo órfão.
 */
export interface ProfileSummary {
  id: string
  name: string
  filePath: string
  /** ISO da última gravação (mtime), para ordenar por "usado por último". */
  updatedAt: string
  /** Perfil ilegível: aparece na lista marcado, sem derrubar os outros (RNF-08). */
  error?: string
}

/** Perfil carregado: o template já validado, a logo resolvida e o que foi corrigido. */
export interface ProfileFile {
  id: string
  template: Template
  /** Logo do perfil já em PNG; `null` quando o perfil não tem logo ou o arquivo sumiu. */
  logo: LogoAsset | null
  /** Campos ausentes/inválidos trocados pelo padrão, e logo não encontrada (ARQUITETURA.md §8). */
  warnings: string[]
}

/**
 * Nome dos arquivos gerados pelo lote (REQUISITOS.md §9.2):
 * `keep` = mesmo nome do original (em outra pasta) · `suffix` = acrescenta `_geo`.
 */
export type OutputNaming = 'keep' | 'suffix'

/** Pedido de lote (RF-09). A saída é sempre JPEG, em pasta diferente da dos originais. */
export interface BatchConfig {
  photos: string[]
  outputDir: string
  template: Template
  naming: OutputNaming
  /** `false`: arquivo já existente na saída é ignorado em vez de sobrescrito. */
  overwrite: boolean
}

/** Andamento do lote (canal `batch:progress`). */
export interface JobProgress {
  total: number
  processed: number
  /** Nome do arquivo em processamento — só para a linha de status. */
  currentFile: string
  succeeded: number
  skipped: number
  failed: number
}

/** Uma foto que não gerou cópia: ignorada (nada a fazer) ou com erro (RNF-08). */
export interface BatchIssue {
  file: string
  reason: string
  /** `true` = ignorada de propósito; `false` = falha real. */
  skipped: boolean
}

/** Resumo do lote (RF-09), devolvido pelo próprio `batch:start`. */
export interface JobResult {
  total: number
  succeeded: number
  skipped: number
  failed: number
  outputDir: string
  /** Interrompido pelo usuário: as cópias já geradas continuam na pasta. */
  canceled: boolean
  elapsedMs: number
  /** Uma linha por foto sem cópia — ignoradas e erros, na ordem em que apareceram. */
  issues: BatchIssue[]
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
  /** Perfis salvos, do mais recente para o mais antigo. */
  listProfiles: () => Promise<ProfileSummary[]>
  loadProfile: (id: string) => Promise<ProfileFile>
  /** `id` nulo cria um perfil novo a partir do `name` do template; senão sobrescreve. */
  saveProfile: (id: string | null, template: Template) => Promise<ProfileSummary>
  duplicateProfile: (id: string) => Promise<ProfileSummary>
  deleteProfile: (id: string) => Promise<void>
  /** Seletor da pasta de saída do lote; `null` se o usuário cancelar. */
  pickOutputDir: () => Promise<string | null>
  /**
   * Roda o lote (RF-09). A promessa **resolve com o resumo** quando o lote termina —
   * não existe canal `batch:done`: um caminho a menos para dessincronizar tela e Main.
   */
  startBatch: (config: BatchConfig) => Promise<JobResult>
  /** Pede a interrupção; o lote termina o que já começou e resolve com `canceled: true`. */
  cancelBatch: () => Promise<void>
  /** Abre a pasta no Explorer. O Main só aceita diretórios (ARQUITETURA.md §11). */
  openPath: (target: string) => Promise<void>
  /** Assina o andamento do lote; devolve a função que cancela a assinatura. */
  onBatchProgress: (listener: (progress: JobProgress) => void) => () => void
}
