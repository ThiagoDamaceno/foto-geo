import { readdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { FIELD_ORDER } from '@shared/field-icons'
import { newLogoId } from '@shared/logo-items'
import { cloneDefaultTemplate } from '@shared/template-defaults'
import type {
  DividerConfig,
  FieldConfig,
  FieldKey,
  LogoAsset,
  LogoConfig,
  ProfileFile,
  ProfileSummary,
  SectionConfig,
  SectionItem,
  Template
} from '@shared/types'
import { isDivider } from '@shared/types'
import { profilesDir, profilesDirPath, toStoredLogoPath } from './app-paths'
import { loadLogoAsset } from './logo.service'

/**
 * Perfis em JSON (RF-07 / ARQUITETURA.md §8): um arquivo por perfil, o `id` é o nome do
 * arquivo. Cada logo é **referenciada por caminho** em `template.logos`.
 *
 * Duas regras que valem para tudo aqui:
 *
 * - **Nada do Renderer vira caminho sem passar por `profilePath()`** — o `id` é validado
 *   contra `ID_PATTERN`, o que fecha a porta para `../` (ARQUITETURA.md §11).
 * - **Perfil inválido não é erro fatal** (RNF-08): campo ruim ou ausente cai no padrão e vira
 *   aviso; arquivo ilegível aparece na lista marcado, sem derrubar os outros.
 */

/** Marca de versão gravada no arquivo — reservada para migrações futuras. */
const PROFILE_VERSION = 1

/** `id` = nome do arquivo: só minúsculas, dígitos e hífen. Também barra `..` e barras. */
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,60}$/

const MAX_NAME_LENGTH = 60

// ── Esquema (Zod) ────────────────────────────────────────────────────────────────────────
// Os limites são os mesmos do editor (`useTemplate`/`InspectorPanel`): um JSON editado à mão
// não pode produzir um carimbo que a UI não conseguiria montar.

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

const pct = z.number().min(0).max(1)
const color = z.string().regex(HEX_COLOR)

const fieldSchema = z.object({
  key: z.enum(FIELD_ORDER as readonly [FieldKey, ...FieldKey[]]),
  visible: z.boolean(),
  showIcon: z.boolean(),
  showLabel: z.boolean()
})

const dividerSchema = z.object({
  type: z.literal('divider'),
  id: z.string().trim().min(1).max(80),
  visible: z.boolean()
})

const nameSchema = z.string().trim().min(1).max(MAX_NAME_LENGTH)

const sectionSchema = {
  x: pct,
  y: pct,
  widthPct: z.number().min(0.08).max(1),
  fontFamily: z.string().trim().min(1).max(40),
  fontPct: z.number().min(0.001).max(0.2),
  lineGapPct: pct,
  paddingPct: pct,
  radiusPct: pct,
  showBorder: z.boolean(),
  bgColor: color,
  bgOpacity: pct,
  textColor: color,
  align: z.enum(['left', 'center', 'right'])
} satisfies { [K in keyof Omit<SectionConfig, 'fields'>]: z.ZodType<SectionConfig[K]> }

/** Os avisos vão para a tela, então falam a língua do inspector, não a do JSON (RNF-07). */
const PROPERTY_LABEL: Record<string, string> = {
  x: 'posição horizontal',
  y: 'posição vertical',
  widthPct: 'largura',
  fontFamily: 'fonte',
  fontPct: 'tamanho da fonte',
  lineGapPct: 'entrelinha',
  paddingPct: 'margem interna',
  radiusPct: 'cantos arredondados',
  showBorder: 'borda do card',
  bgColor: 'cor de fundo',
  bgOpacity: 'opacidade do fundo',
  textColor: 'cor do texto',
  align: 'alinhamento',
  filePath: 'arquivo',
  opacity: 'opacidade'
}

const logoSchema = z.object({
  id: z.string().trim().min(1).max(80),
  filePath: z.string().trim().min(1),
  x: pct,
  y: pct,
  widthPct: z.number().min(0.02).max(1),
  opacity: pct
})

// ── Leitura ──────────────────────────────────────────────────────────────────────────────

/** Perfis salvos, do mais recente para o mais antigo. */
export async function listProfiles(): Promise<ProfileSummary[]> {
  const dir = await profilesDir()

  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }

  const summaries = await Promise.all(
    entries
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => summarize(entry.slice(0, -'.json'.length)))
  )

  return summaries
    .filter((summary): summary is ProfileSummary => summary !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Carrega um perfil já validado, com as logos resolvidas e a lista do que foi corrigido. */
export async function loadProfile(id: string): Promise<ProfileFile> {
  await profilesDir()
  const filePath = profilePath(id)
  const raw = await readJson(filePath)
  const { template, warnings } = parseTemplate(raw, fallbackName(id))
  const { assets, warnings: logoWarnings } = await resolveLogos(template.logos)

  return {
    id,
    template,
    logos: assets,
    warnings: [...warnings, ...logoWarnings]
  }
}

/** Template validado/coerido — usado pelo lote (mesmos limites do perfil). */
export function coerceTemplate(raw: unknown): Template {
  return parseTemplate(raw, 'Lote').template
}

// ── Gravação ─────────────────────────────────────────────────────────────────────────────

/**
 * Grava o perfil. Com `id`, sobrescreve (renomear o perfil mantém o mesmo arquivo);
 * sem `id`, cria um arquivo novo a partir do nome.
 */
export async function saveProfile(id: string | null, raw: unknown): Promise<ProfileSummary> {
  await profilesDir()
  const { template } = parseTemplate(raw, 'Perfil')
  const targetId = id === null ? await uniqueId(slugify(template.name)) : assertId(id)

  await writeProfile(targetId, template)
  return (await summarize(targetId)) ?? { ...emptySummary(targetId, template.name) }
}

/** Copia um perfil existente como "… (cópia)" em um arquivo novo. */
export async function duplicateProfile(id: string): Promise<ProfileSummary> {
  const source = await loadProfile(id)
  const name = await uniqueName(source.template.name)
  const copyId = await uniqueId(slugify(name))

  await writeProfile(copyId, { ...source.template, name })
  return (await summarize(copyId)) ?? { ...emptySummary(copyId, name) }
}

export async function deleteProfile(id: string): Promise<void> {
  await profilesDir()
  await unlink(profilePath(id))
}

/** Gravação em dois passos: um `.tmp` completo antes do `rename`, para não deixar JSON pela metade. */
async function writeProfile(id: string, template: Template): Promise<void> {
  await profilesDir()
  const stored: Template = {
    ...template,
    logos: template.logos.map((logo) => ({
      ...logo,
      filePath: toStoredLogoPath(logo.filePath)
    }))
  }
  const filePath = profilePath(id)
  const tmpPath = `${filePath}.tmp`
  const content = JSON.stringify({ version: PROFILE_VERSION, ...stored }, null, 2)

  await writeFile(tmpPath, `${content}\n`, 'utf8')
  await rename(tmpPath, filePath)
}

// ── Validação ────────────────────────────────────────────────────────────────────────────

/**
 * JSON → `Template`, campo por campo: o que é inválido volta ao padrão e gera aviso; o que
 * está ausente volta ao padrão em silêncio (compatibilidade entre versões — ARQUITETURA.md §8).
 */
function parseTemplate(raw: unknown, defaultName: string): { template: Template; warnings: string[] } {
  const warnings: string[] = []
  const template = cloneDefaultTemplate()
  const source = isRecord(raw) ? raw : {}

  if (!isRecord(raw)) warnings.push('Arquivo não é um objeto JSON — perfil padrão aplicado.')

  template.name = pick(nameSchema, source.name, defaultName, 'Nome', warnings)

  const section = isRecord(source.section) ? source.section : {}
  if (source.section !== undefined && !isRecord(source.section)) {
    warnings.push('Seção inválida — configuração padrão aplicada.')
  }

  for (const [key, schema] of Object.entries(sectionSchema)) {
    assign(template.section, key as keyof typeof sectionSchema, schema, section[key], warnings, 'Seção')
  }
  template.section.fields = normalizeFields(section.fields, template.section.fields, warnings)

  template.logos = normalizeLogos(source, warnings)

  return { template, warnings }
}

/**
 * Aceita `logos[]` (formato atual) ou o antigo `logo` singular.
 * Entradas inválidas saem; ids duplicados ganham um id novo.
 */
function normalizeLogos(source: Record<string, unknown>, warnings: string[]): LogoConfig[] {
  let rawList: unknown[]

  if (Array.isArray(source.logos)) {
    rawList = source.logos
  } else if (isRecord(source.logo) && typeof source.logo.filePath === 'string' && source.logo.filePath) {
    rawList = [source.logo]
  } else {
    if (source.logos !== undefined) warnings.push('Lista de logos inválida — nenhuma logo aplicada.')
    else if (source.logo !== undefined) warnings.push('Logo inválida — removida.')
    return []
  }

  const seen = new Set<string>()
  const logos: LogoConfig[] = []

  for (const entry of rawList) {
    if (!isRecord(entry)) {
      warnings.push('Item de logo inválido — ignorado.')
      continue
    }

    const parsed = logoSchema.safeParse({
      id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : newLogoId(),
      filePath: entry.filePath,
      x: entry.x,
      y: entry.y,
      widthPct: entry.widthPct,
      opacity: entry.opacity
    })

    if (!parsed.success) {
      warnings.push('Item de logo inválido — ignorado.')
      continue
    }

    let { id } = parsed.data
    if (seen.has(id)) {
      id = newLogoId()
      warnings.push('Id de logo duplicado — regenerado.')
    }
    seen.add(id)
    logos.push({ ...parsed.data, id })
  }

  return logos
}

/**
 * A ordem do array é a ordem vertical do carimbo (campos + divisores). Campos desconhecidos
 * e repetidos saem; campos que faltam entram no fim com o padrão. Divisores inválidos saem.
 */
function normalizeFields(
  raw: unknown,
  defaults: SectionItem[],
  warnings: string[]
): SectionItem[] {
  if (raw === undefined) return defaults
  if (!Array.isArray(raw)) {
    warnings.push('Lista de campos inválida — ordem padrão aplicada.')
    return defaults
  }

  const items: SectionItem[] = []
  const seenFields = new Set<FieldKey>()
  const seenDividers = new Set<string>()
  let dropped = 0

  for (const entry of raw) {
    if (isRecord(entry) && entry['type'] === 'divider') {
      const result = dividerSchema.safeParse(entry)
      if (!result.success || seenDividers.has(result.data.id)) {
        dropped += 1
        continue
      }
      seenDividers.add(result.data.id)
      items.push(result.data satisfies DividerConfig)
      continue
    }

    const result = fieldSchema.safeParse(entry)
    if (!result.success || seenFields.has(result.data.key)) {
      dropped += 1
      continue
    }
    seenFields.add(result.data.key)
    items.push(result.data)
  }

  if (dropped > 0) warnings.push(`${dropped} item(ns) desconhecido(s) ignorado(s).`)

  const defaultFields = defaults.filter((item): item is FieldConfig => !isDivider(item))
  const missing = defaultFields.filter((field) => !seenFields.has(field.key))
  if (missing.length > 0 && items.length > 0) {
    warnings.push(`${missing.length} campo(s) ausente(s) adicionado(s) no fim.`)
  }

  return items.length > 0 ? [...items, ...missing] : defaults
}

function assign<T, K extends keyof T>(
  target: T,
  key: K,
  schema: z.ZodType<unknown>,
  value: unknown,
  warnings: string[],
  group: string
): void {
  const label = `${group} · ${PROPERTY_LABEL[String(key)] ?? String(key)}`
  target[key] = pick(schema as z.ZodType<T[K]>, value, target[key], label, warnings)
}

function pick<T>(
  schema: z.ZodType<T>,
  value: unknown,
  fallback: T,
  label: string,
  warnings: string[]
): T {
  if (value === undefined) return fallback

  const result = schema.safeParse(value)
  if (result.success) return result.data

  warnings.push(`${label}: valor inválido (${describe(value)}) — padrão aplicado.`)
  return fallback
}

// ── Arquivos ─────────────────────────────────────────────────────────────────────────────

function profilePath(id: unknown): string {
  return join(profilesDirPath(), `${assertId(id)}.json`)
}

function assertId(id: unknown): string {
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) throw new Error('Perfil inválido')
  return id
}

async function readJson(filePath: string): Promise<unknown> {
  const content = await readFile(filePath, 'utf8')
  try {
    return JSON.parse(content)
  } catch {
    throw new Error('Arquivo de perfil corrompido (JSON inválido)')
  }
}

/** Linha da lista. Perfil ilegível vira uma entrada com `error` em vez de exceção (RNF-08). */
async function summarize(id: string): Promise<ProfileSummary | null> {
  if (!ID_PATTERN.test(id)) return null

  const filePath = profilePath(id)

  let updatedAt: string
  try {
    updatedAt = new Date((await stat(filePath)).mtimeMs).toISOString()
  } catch {
    return null
  }

  try {
    const raw = await readJson(filePath)
    const name = nameSchema.safeParse(isRecord(raw) ? raw.name : undefined)
    return { id, name: name.success ? name.data : fallbackName(id), filePath, updatedAt }
  } catch (cause) {
    return {
      id,
      name: fallbackName(id),
      filePath,
      updatedAt,
      error: cause instanceof Error ? cause.message : String(cause)
    }
  }
}

/**
 * Carrega as logos do perfil (RF-06). Arquivo ausente/ilegível vira aviso, mas o
 * `filePath` **permanece** no template — drive/USB pode voltar (RNF-08 / §8).
 */
async function resolveLogos(
  logos: LogoConfig[]
): Promise<{ assets: LogoAsset[]; warnings: string[] }> {
  const assets: LogoAsset[] = []
  const warnings: string[] = []

  for (const logo of logos) {
    try {
      const asset = await loadLogoAsset(logo.filePath)
      assets.push({ ...asset, id: logo.id })
    } catch {
      warnings.push(`Logo não encontrada (mantida no perfil): ${logo.filePath}`)
    }
  }

  return { assets, warnings }
}

// ── Nomes e ids ──────────────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // acentos fora: o id é o nome do arquivo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')

  return ID_PATTERN.test(slug) ? slug : 'perfil'
}

/** `perfil`, `perfil-2`, `perfil-3`… — nome novo nunca sobrescreve perfil existente. */
async function uniqueId(base: string): Promise<string> {
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`
    if (!(await exists(profilePath(candidate)))) return candidate
  }

  throw new Error('Não foi possível criar o arquivo do perfil')
}

/**
 * `X (cópia)`, `X (cópia 2)`… — duplicar duas vezes o mesmo perfil não pode deixar dois nomes
 * iguais na lista (os arquivos são distintos, mas quem escolhe olha o nome).
 */
async function uniqueName(sourceName: string): Promise<string> {
  const taken = new Set((await listProfiles()).map((profile) => profile.name))

  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const candidate = truncateName(
      suffix === 1 ? `${sourceName} (cópia)` : `${sourceName} (cópia ${suffix})`
    )
    if (!taken.has(candidate)) return candidate
  }

  return truncateName(`${sourceName} (cópia)`)
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

function fallbackName(id: string): string {
  return id.replace(/-/g, ' ')
}

function truncateName(name: string): string {
  return name.length > MAX_NAME_LENGTH ? name.slice(0, MAX_NAME_LENGTH).trimEnd() : name
}

function emptySummary(id: string, name: string): ProfileSummary {
  return { id, name, filePath: profilePath(id), updatedAt: new Date().toISOString() }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Valor inválido resumido para o aviso — sem despejar o JSON inteiro na tela. */
function describe(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  const shown = text ?? String(value)
  return shown.length > 24 ? `${shown.slice(0, 24)}…` : shown
}
