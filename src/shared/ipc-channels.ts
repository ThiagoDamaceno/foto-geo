/** Nomes dos canais IPC — únicos e usados pelos dois lados (ARQUITETURA.md §5). */
export const IPC = {
  ping: 'app:ping',
  appInfo: 'app:info'
} as const
