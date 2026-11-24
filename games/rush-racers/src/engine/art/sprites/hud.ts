/**
 * World-side HUD sprites: the kick-ready pip, which changes shape as well as colour when it cools
 * down.
 */
import { Frame, Tex } from '../keys.ts';
import { HudPalette } from '../palettes.ts';
import { type ArtSheet, sheet } from './sheet.ts';

/** HUD sheets. */
export const HUD_SHEETS: readonly ArtSheet[] = [
  sheet(Tex.kickPip, HudPalette.kickPip, {
    [Frame.pipReady]: ['.1111.', '111111', '112211', '112211', '111111', '.1111.'],
    [Frame.pipCooling]: ['.0000.', '00..00', '0....0', '0....0', '00..00', '.0000.'],
  }),
];
