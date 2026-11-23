/**
 * The sea's surface: the flat sky tile drawn over air, and the rolling wave crest drawn along the
 * top of the water under it. The crest repeats every 8 px and its second frame is the first moved
 * half a wave along, so the two-frame loop reads as the surface rolling.
 */

import { Frame } from '../../../art/keys.ts';
import type { NamedFrame, PixelRows } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { OceanTex, type OceanTexKey } from '../keys.ts';
import { TerrainPalette } from '../palettes.ts';

/** The sky tile, one flat colour so racers in the air read against it. Laid out in `OceanTile` order by `terrain.ts`. */
export const SKY_TILE: NamedFrame = {
  name: 'sky',
  palette: TerrainPalette.sky,
  rows: Array.from({ length: 16 }, () => '0'.repeat(16)),
};

/** One 8 px wave of the crest, top row first: sky between the wave tops, foam, crest, then lit water fading out. */
const WAVE: PixelRows = ['33222333', '22111222', '11111111', '0.0.0.0.', '.0...0..'];

/** Rows of the 16x16 crest frame with the wave moved `shift` px along. */
function crestRows(shift: number): PixelRows {
  const crest = WAVE.map((wave) => {
    const rolled = wave.slice(shift) + wave.slice(0, shift);
    return rolled + rolled;
  });
  const below = Array.from({ length: 16 - crest.length }, () => '.'.repeat(16));
  return [...crest, ...below];
}

/** The waterline sheet, frames `a` and `b` of the roll loop. */
export const SURFACE_SHEETS: readonly ArtSheet<OceanTexKey>[] = [
  sheet(OceanTex.waterline, TerrainPalette.waterline, {
    [Frame.a]: crestRows(0),
    [Frame.b]: crestRows(4),
  }),
];
