/**
 * Hazards: a spiny urchin and a pulsing jellyfish. Both are dark-outlined
 * with sharp, stinging shapes, so they read as dangerous by silhouette and
 * not by colour alone.
 */
import { Frame, Tex } from '../keys.ts';
import { HazardPalette } from '../palettes.ts';
import { type ArtSheet, sheet } from './sheet.ts';

/** Hazard sheets. The jelly's `a` frame is the open bell, `b` the squeezed one. */
export const HAZARD_SHEETS: readonly ArtSheet[] = [
  sheet(Tex.urchin, HazardPalette.urchin, {
    [Frame.a]: [
      '2....2....2.',
      '.0...0...0..',
      '..0.000.0...',
      '...011110...',
      '..01211110..',
      '200121111002',
      '..01111110..',
      '...011110...',
      '..0.000.0...',
      '.0...0...0..',
      '2....0....2.',
      '.....2......',
    ],
  }),
  sheet(Tex.jelly, HazardPalette.jelly, {
    [Frame.a]: [
      '..00111100..',
      '.0111111110.',
      '011221111110',
      '011211111110',
      '011111111110',
      '011111111110',
      '.0000000000.',
      '.3..3..3..3.',
      '3..3..3..3..',
      '.3..3..3..3.',
      '3..3..3..3..',
      '.3.....3....',
      '3.......3...',
      '............',
    ],
    [Frame.b]: [
      '...011110...',
      '..01111110..',
      '.0112211110.',
      '.0112111110.',
      '.0111111110.',
      '.0111111110.',
      '.0111111110.',
      '..00000000..',
      '..3.3.3.3...',
      '..3.3.3.3...',
      '...3.3.3....',
      '...3.3.3....',
      '..3.3.3.3...',
      '....3.3.....',
    ],
  }),
];
