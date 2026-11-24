/**
 * Reef's attack art that lives in the water rather than in the HUD well: the Homing Squid (a swim
 * cycle and a latched pose that wraps a racer), one tile of a Riptide lane, the speed lines
 * Undertow draws ahead of a racer it pulls back, the Ink Sac cloud, the trapping bubble and the
 * halo behind a loose power-up. The squid is drawn in the item palette in `item-rows.ts`, so it keeps
 * its icon's colour.
 */
import { Frame } from '../../../art/keys.ts';
import type { Palette } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { ReefTex } from '../keys.ts';
import { ReefItemPalette } from './item-rows.ts';

/** The lane tile: a dark shadow line, foam streaks and mint tails, so the flow reads over a current. */
const RIPTIDE_TILE_PALETTE: Palette = [0x1c9a5c, 0xd8ffe8, 0x7fe8b0];

/** Speed lines: a violet shadow, a pale core and a brighter lead. */
const UNDERTOW_LINE_PALETTE: Palette = [0x6a58e8, 0xe8e0ff, 0xb8a8ff];

/** Ink cloud: core and dithered edge. */
const INK_CLOUD_PALETTE: Palette = [0x0a0614, 0x241a3c];

/** Trapping bubble: rim and shine. */
const BUBBLE_PALETTE: Palette = [0xb8f4ff, 0xffffff];

/** Loose power-up halo: two dithered rings of light. */
const LOOSE_GLOW_PALETTE: Palette = [0xfff0a0, 0xffffff];

/** Size of one Riptide lane tile, px. */
export const RIPTIDE_TILE = 16;

/** World sheets for the squid, the lane tile, the pull lines, the ink cloud, the bubble and the loose glow. */
export const REEF_ATTACK_SHEETS: readonly ArtSheet<string>[] = [
  // Pointing right with the tentacles trailing, so the view only has to rotate it to its heading.
  sheet(ReefTex.squid, ReefItemPalette.homingSquid, {
    [Frame.a]: [
      '................',
      '.......000000...',
      '......01111110..',
      '...110112221110.',
      '111.011111130110',
      '...1111111111110',
      '....011111111110',
      '...110111111110.',
      '111...01111110..',
      '.......000000...',
      '................',
      '................',
    ],
    [Frame.b]: [
      '................',
      '.......000000...',
      '111...01111110..',
      '...110112221110.',
      '....011111130110',
      '...1111111111110',
      '111.011111111110',
      '...110111111110.',
      '......01111110..',
      '.......000000...',
      '................',
      '................',
    ],
    // Mantle on the racer's head, arms wrapped across its body, a 1 px foam rim round the outside so it reads against the racer.
    [Frame.squidLatched]: [
      '...33333........',
      '..3000003.......',
      '.301211103......',
      '30111130103.....',
      '.301111113......',
      '..311000113.....',
      '.333113331133...',
      '31113113332113..',
      '.33311111131213.',
      '....323113.33113',
      '.....3.3113..33.',
      '........33......',
    ],
  }),
  // Arrowed streaks pointing right, tiling seamlessly; a lane scrolls and turns this one frame to its heading.
  sheet(ReefTex.riptideStreak, RIPTIDE_TILE_PALETTE, {
    [Frame.a]: [
      '................',
      '................',
      '.......1........',
      '222111111.......',
      '000000010.......',
      '.......0........',
      '................',
      '.............1..',
      '......222111111.',
      '......000000010.',
      '.............0..',
      '................',
      '..........1.....',
      '...222111111....',
      '...000000010....',
      '..........0.....',
    ],
  }),
  sheet(ReefTex.undertowStreak, UNDERTOW_LINE_PALETTE, {
    [Frame.a]: [
      '................',
      '2221111111......',
      '0000000000......',
      '................',
      '.....2211111....',
      '.....0000000....',
      '................',
      '..222211111111..',
      '..000000000000..',
      '................',
    ],
    [Frame.b]: [
      '................',
      '....2221111111..',
      '....0000000000..',
      '................',
      '.........2211111',
      '.........0000000',
      '................',
      '11....2222111111',
      '00....0000000000',
      '................',
    ],
  }),
  sheet(ReefTex.inkCloud, INK_CLOUD_PALETTE, {
    [Frame.a]: [
      '........................',
      '...........1.1.1........',
      '..........1.00001.1.....',
      '.......1.100000000.1....',
      '....1.1.10000000000.....',
      '...1.000000000000001....',
      '..1.000000000000000.1...',
      '...0000000000000000001..',
      '..100000000000000000001.',
      '...0000000000000000000..',
      '..100000000000000000001.',
      '...1000000000000000000..',
      '....10000000000000000.1.',
      '.....1.000000001.001.1..',
      '......1.10000.1.1.1.....',
      '.........1.1.1..........',
    ],
  }),
  sheet(ReefTex.bubble, BUBBLE_PALETTE, {
    [Frame.a]: [
      '...0000...',
      '.00....00.',
      '.011....0.',
      '0.1......0',
      '0........0',
      '0........0',
      '0........0',
      '.0......0.',
      '.00....00.',
      '...0000...',
    ],
  }),
  sheet(ReefTex.looseGlow, LOOSE_GLOW_PALETTE, {
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
