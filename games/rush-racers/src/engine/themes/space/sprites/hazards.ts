/**
 * Hazards: a space mine and a plasma orb. Both are dark-outlined, so they read as dangerous by
 * silhouette and not by colour alone: the mine by its eight spikes, the orb by the sparks it throws.
 */
import { Frame } from '../../../art/keys.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { SpaceTex, type SpaceTexKey } from '../keys.ts';
import { SpaceHazardPalette } from '../palettes.ts';

/** The space mine: a riveted round body with a spike at every compass point, each spike ending in a hot tip. Still. */
const MINE_ROWS = [
  '.....22.....',
  '.2...00...2.',
  '..0.0110.0..',
  '...011110...',
  '..01101110..',
  '200111111002',
  '200111111002',
  '..01110110..',
  '...011110...',
  '..0.0110.0..',
  '.2...00...2.',
  '.....22.....',
];

/** The plasma orb drawn in: a small glowing ball, white-hot at its upper left, with sparks close by. */
const ORB_IN_ROWS = [
  '............',
  '.....3......',
  '............',
  '....0000....',
  '...011110...',
  '..01331110..',
  '3.01311110..',
  '..01111110.3',
  '..01111210..',
  '...011220...',
  '....0000....',
  '............',
  '......3.....',
  '............',
];

/** The plasma orb swelled out: the same ball two pixels wider, its sparks thrown to the corners. */
const ORB_OUT_ROWS = [
  '..3......3..',
  '............',
  '...000000...',
  '..01111110..',
  '.0113311110.',
  '.0133111110.',
  '.0131111110.',
  '.0111111110.',
  '.0111111210.',
  '.0111112210.',
  '..01122210..',
  '...000000...',
  '............',
  '..3......3..',
];

/** Hazard sheets. The orb pulses between its drawn-in `a` frame and its swelled `b` frame. */
export const HAZARD_SHEETS: readonly ArtSheet<SpaceTexKey>[] = [
  sheet(SpaceTex.mine, SpaceHazardPalette.mine, { [Frame.a]: MINE_ROWS }),
  sheet(SpaceTex.orb, SpaceHazardPalette.orb, { [Frame.a]: ORB_IN_ROWS, [Frame.b]: ORB_OUT_ROWS }),
];
