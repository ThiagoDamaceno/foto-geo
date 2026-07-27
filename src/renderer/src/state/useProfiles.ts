import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LogoAsset, ProfileSummary, Template } from '@shared/types'
import { messageOf } from '../lib/ipc-error'

export interface ProfilesState {
  profiles: ProfileSummary[]
  /** Perfil aberto no editor; `null` quando o template atual ainda não foi salvo. */
  activeId: string | null
  /** Template mudou desde o último salvar/carregar. */
  isDirty: boolean
  isBusy: boolean
  error: string | null
  /** Correções feitas ao carregar (campo inválido, logo ausente) — ARQUITETURA.md §8. */
  warnings: string[]
  /** Sobrescreve o perfil ativo; sem ativo, cria um novo com o nome atual. */
  save: () => Promise<void>
  /** Salva sempre em um arquivo novo (usa o nome atual). */
  saveAsNew: () => Promise<void>
  load: (id: string) => Promise<void>
  duplicate: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Volta ao template padrão e sai do perfil ativo. */
  detach: () => void
  dismiss: () => void
}

/**
 * Perfis salvos (RF-07). O Main é a fonte da verdade: toda operação grava/lê o `.json` e
 * recarrega a lista, então não existe estado de perfil que só exista na tela.
 *
 * Nenhum `catch` aqui pode escapar: sem console para o usuário (RNF-10), uma exceção solta
 * derrubaria a árvore do React e deixaria a janela em branco.
 */
export function useProfiles(
  template: Template,
  applyTemplate: (template: Template, logos: LogoAsset[]) => void,
  resetTemplate: () => void
): ProfilesState {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  const refresh = useCallback(async (): Promise<ProfileSummary[]> => {
    const list = await window.fotoGeo.listProfiles()
    setProfiles(list)
    return list
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        await refresh()
      } catch {
        // lista vazia é um estado válido; o erro reaparece na primeira ação do usuário
      }
    })()
  }, [refresh])

  /** Envelope comum: ocupado, mensagens limpas e erro apresentável em vez de exceção. */
  const perform = useCallback(async (task: () => Promise<void>): Promise<void> => {
    setIsBusy(true)
    setError(null)
    try {
      await task()
    } catch (cause) {
      setError(messageOf(cause))
    } finally {
      setIsBusy(false)
    }
  }, [])

  const writeProfile = useCallback(
    (id: string | null): Promise<void> =>
      perform(async () => {
        const summary = await window.fotoGeo.saveProfile(id, template)
        setActiveId(summary.id)
        setSavedSnapshot(JSON.stringify(template))
        setWarnings([])
        await refresh()
      }),
    [perform, refresh, template]
  )

  const save = useCallback((): Promise<void> => writeProfile(activeId), [activeId, writeProfile])
  const saveAsNew = useCallback((): Promise<void> => writeProfile(null), [writeProfile])

  const load = useCallback(
    (id: string): Promise<void> =>
      perform(async () => {
        const profile = await window.fotoGeo.loadProfile(id)
        applyTemplate(profile.template, profile.logos)
        setActiveId(profile.id)
        setSavedSnapshot(JSON.stringify(profile.template))
        setWarnings(profile.warnings)
      }),
    [applyTemplate, perform]
  )

  const duplicate = useCallback(
    (id: string): Promise<void> =>
      perform(async () => {
        const summary = await window.fotoGeo.duplicateProfile(id)
        await refresh()
        // abrir a cópia é o que o usuário quer em seguida: duplicar serve para variar dela
        const copy = await window.fotoGeo.loadProfile(summary.id)
        applyTemplate(copy.template, copy.logos)
        setActiveId(copy.id)
        setSavedSnapshot(JSON.stringify(copy.template))
        setWarnings(copy.warnings)
      }),
    [applyTemplate, perform, refresh]
  )

  const remove = useCallback(
    (id: string): Promise<void> =>
      perform(async () => {
        await window.fotoGeo.deleteProfile(id)
        await refresh()
        if (id !== activeId) return

        // o perfil aberto deixou de existir: o template continua na tela, mas solto
        setActiveId(null)
        setSavedSnapshot(null)
        setWarnings([])
      }),
    [activeId, perform, refresh]
  )

  const detach = useCallback((): void => {
    resetTemplate()
    setActiveId(null)
    setSavedSnapshot(null)
    setWarnings([])
    setError(null)
  }, [resetTemplate])

  const dismiss = useCallback((): void => {
    setError(null)
    setWarnings([])
  }, [])

  const isDirty = useMemo(
    () => savedSnapshot !== null && savedSnapshot !== JSON.stringify(template),
    [savedSnapshot, template]
  )

  return {
    profiles,
    activeId,
    isDirty,
    isBusy,
    error,
    warnings,
    save,
    saveAsNew,
    load,
    duplicate,
    remove,
    detach,
    dismiss
  }
}
