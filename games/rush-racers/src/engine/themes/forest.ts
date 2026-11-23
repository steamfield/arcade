/**
 * The forest look: Thornwood's earth, branches, canopy and light. Placeholder art: the ocean theme's
 * textures under the forest's id, so a Thornwood course names its own theme before the forest is
 * drawn. Its colours are fixed in `forest/palettes.ts`, and its contrast bands are already the
 * forest's, so every racer and all global art are held to them.
 */
import { ForestBackdropPalette, WOOD_BANDS } from './forest/palettes.ts';
import { OCEAN_THEME } from './ocean.ts';
import type { ContrastBand, Theme } from './types.ts';

/** Every canopy band and backdrop layer colour: everything a racer or off-panel text can sit in front of. */
const FOREST_CONTRAST_BANDS: readonly ContrastBand[] = [
  ...WOOD_BANDS.map((colour, band) => ({ name: `canopy band ${band}`, colour })),
  ...ForestBackdropPalette.far.map((colour, index) => ({ name: `far trees ${index}`, colour })),
  ...ForestBackdropPalette.near.map((colour, index) => ({ name: `near trunks ${index}`, colour })),
];

/** The forest theme. */
export const FOREST_THEME: Theme = {
  ...OCEAN_THEME,
  id: 'forest',
  registerTextures: () => {},
  contrastBands: FOREST_CONTRAST_BANDS,
};
