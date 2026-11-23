/**
 * Things a racer swims into for a reward: pearls, clams (closed, then open
 * showing the prize) and the halo drawn behind a loose power-up.
 */
import { Frame, Tex } from '../keys.ts';
import { ItemPalette } from '../palettes.ts';
import { type ArtSheet, sheet } from './sheet.ts';

/** Pickup sheets. */
export const PICKUP_SHEETS: readonly ArtSheet[] = [
  sheet(Tex.pearl, ItemPalette.pearl, {
    [Frame.a]: ['..000..', '.01110.', '0121110', '0111110', '0111110', '.01110.', '..000..'],
  }),
  sheet(Tex.clam, ItemPalette.clam, {
    [Frame.clamClosed]: [
      '................',
      '................',
      '.....000000.....',
      '...0012121200...',
      '..012121212120..',
      '.01212121212120.',
      '.00000000000000.',
      '..011111111110..',
      '...0012121200...',
      '.....000000.....',
    ],
    [Frame.clamOpen]: [
      '....00000000....',
      '..001212121200..',
      '.01212121212120.',
      '.00000000000000.',
      '......0330......',
      '.....033230.....',
      '.00000333300000.',
      '.01111000011110.',
      '..001212121200..',
      '....00000000....',
    ],
  }),
  sheet(Tex.looseGlow, ItemPalette.looseGlow, {
    [Frame.a]: [
      '........0.......',
      '.....0.0.0.0....',
      '....0..1....0...',
      '.............0..',
      '..0...........0.',
      '.0..............',
      '..............0.',
      '.01............0',
      '0............10.',
      '.0..............',
      '..............0.',
      '.0...........0..',
      '..0.............',
      '...0....1..0....',
      '....0.0.0.0.....',
      '.......0........',
    ],
  }),
];
