import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { resolveFontsDirSync } from './font-env'

/**
 * SVG do carimbo → PNG com Roboto embarcada.
 * O Sharp/librsvg no Windows ignora @font-face e falha com fontconfig custom;
 * o resvg carrega o `.ttf` direto (`fontFiles`).
 */
export function rasterizeOverlaySvg(svg: string, size: { width: number; height: number }): Buffer {
  const fontFile = join(resolveFontsDirSync(), 'roboto.ttf')
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size.width },
    font: {
      fontFiles: [fontFile],
      loadSystemFonts: false,
      defaultFontFamily: 'Roboto'
    }
  })

  return Buffer.from(resvg.render().asPng())
}
