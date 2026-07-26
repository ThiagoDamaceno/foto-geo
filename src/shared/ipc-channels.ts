/** Nomes dos canais IPC — únicos e usados pelos dois lados (ARQUITETURA.md §5). */
export const IPC = {
  ping: 'app:ping',
  appInfo: 'app:info',
  pickImages: 'dialog:pickImages',
  pickFolder: 'dialog:pickFolder',
  scanPhotos: 'photos:scan',
  previewImage: 'photos:preview',
  renderPreview: 'preview:render'
} as const
