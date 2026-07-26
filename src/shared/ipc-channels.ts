/** Nomes dos canais IPC — únicos e usados pelos dois lados (ARQUITETURA.md §5). */
export const IPC = {
  ping: 'app:ping',
  appInfo: 'app:info',
  pickImages: 'dialog:pickImages',
  pickFolder: 'dialog:pickFolder',
  scanPhotos: 'photos:scan',
  previewImage: 'photos:preview',
  renderPreview: 'preview:render',
  pickLogo: 'logo:pick',
  readLogo: 'logo:read',
  profilesList: 'profiles:list',
  profilesLoad: 'profiles:load',
  profilesSave: 'profiles:save',
  profilesDuplicate: 'profiles:duplicate',
  profilesDelete: 'profiles:delete',
  pickOutputDir: 'dialog:pickOutputDir',
  batchStart: 'batch:start',
  batchCancel: 'batch:cancel',
  /** Único canal M→R do app: o resultado do lote volta no `invoke` do `batch:start`. */
  batchProgress: 'batch:progress',
  openPath: 'shell:openPath'
} as const
