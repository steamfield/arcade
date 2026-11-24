/**
 * Every global sprite sheet in one list, gathered from the family files so the art builder and the
 * art data test walk the same set. A world's sheets live with the world, a theme's with the theme.
 */
import { GUIDE_SHEETS } from './guide.ts';
import { HUD_SHEETS } from './hud.ts';
import type { ArtSheet } from './sheet.ts';

export type { ArtSheet } from './sheet.ts';

/** All global art: the HUD sprites and the guide arrow. */
export const ART_SHEETS: readonly ArtSheet[] = [...HUD_SHEETS, ...GUIDE_SHEETS];
