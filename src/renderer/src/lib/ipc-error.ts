/**
 * Mensagem de erro apresentável ao usuário.
 *
 * O `ipcRenderer.invoke` embrulha a falha do Main em
 * `Error invoking remote method 'batch:start': Error: Escolha a pasta de saída` — o prefixo é
 * ruído de transporte. Sem console (RNF-10), o texto na tela é a única pista que o usuário tem,
 * então ele mostra só a mensagem escrita no serviço.
 */
export function messageOf(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause)
  return raw.replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, '').trim() || raw
}
