/**
 * The sky look: Cloudreach's thunderheads, puff, bounce and fog clouds, wind, cloud banks and
 * sunlight. Placeholder art: the ocean theme's textures (bounce tile included) under the sky's id, so
 * a Cloudreach course names its own theme before the sky is drawn. Its colours are fixed in
 * `sky/palettes.ts`, and its contrast bands are already the sky's, so every racer and all global art
 * are held to them.
 */
import { OCEAN_THEME } from './ocean.ts';
import { SKY_BANDS, SkyBackdropPalette } from './sky/palettes.ts';
import type { ContrastBand, Theme } from './types.ts';

/** Every sky band and cloud bank colour: everything a racer or off-panel text can sit in front of. */
const SKY_CONTRAST_BANDS: readonly ContrastBand[] = [
  ...SKY_BANDS.map((colour, band) => ({ name: `sky band ${band}`, colour })),
  ...SkyBackdropPalette.far.map((colour, index) => ({ name: `far clouds ${index}`, colour })),
  ...SkyBackdropPalette.near.map((colour, index) => ({ name: `near clouds ${index}`, colour })),
];

/** The sky theme. */
export const SKY_THEME: Theme = {
  ...OCEAN_THEME,
  id: 'sky',
  registerTextures: () => {},
  contrastBands: SKY_CONTRAST_BANDS,
};
