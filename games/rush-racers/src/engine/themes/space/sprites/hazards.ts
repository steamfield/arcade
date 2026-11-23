/**
 * Hazards: a thorn bush and a buzzing wasp. Both are dark-outlined with sharp, stinging shapes, so
 * they read as dangerous by silhouette and not by colour alone.
 */
import { Frame } from '../../../art/keys.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { SpaceTex, type SpaceTexKey } from '../keys.ts';
import { SpaceHazardPalette } from '../palettes.ts';

/** Hazard sheets. The wasp's `a` frame has its wings up, `b` has them down. */
export const HAZARD_SHEETS: readonly ArtSheet<SpaceTexKey>[] = [
  sheet(SpaceTex.thornBush, SpaceHazardPalette.thornBush, {
    [Frame.a]: [
      '.2...2..2...',
      '.0..0.0.0.2.',
      '20.0.000.0..',
      '.0011111100.',
      '.0112111110.',
      '200111111002',
      '.0111111110.',
      '..011121110.',
      '.0.0011110.2',
      '2.0.0000.0..',
      '..2.0..0.2..',
      '.....22.....',
    ],
  }),
  sheet(SpaceTex.wasp, SpaceHazardPalette.wasp, {
    [Frame.a]: [
      '...3....3...',
      '..33....33..',
      '..3.0000.3..',
      '...0111100..',
      '..012212100.',
      '..01221210..',
      '...0111100..',
      '...0122120..',
      '....01110...',
      '.....010....',
      '......0.....',
      '............',
      '............',
      '............',
    ],
    [Frame.b]: [
      '............',
      '............',
      '....0000....',
      '...0111100..',
      '.3.012212100',
      '33.01221210.',
      '3..0111100..',
      '...0122120..',
      '....01110...',
      '.....010....',
      '......0.....',
      '..3.....3...',
      '..33...33...',
      '...3...3....',
    ],
  }),
];
