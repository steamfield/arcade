/**
 * Art for the attack power-ups that lives in the water rather than in the HUD well: the Homing
 * Squid (a swim cycle and a latched pose that wraps a racer), one tile of a Riptide lane, and the
 * speed lines Undertow draws ahead of a racer it pulls back. The held icons are in `powerups.ts`
 * and `ui/icons.ts`, drawn from the palettes below so a kind keeps one colour everywhere.
 */
import { Frame, Tex } from '../keys.ts';
import type { Palette, PixelRows } from '../pixel.ts';
import { type ArtSheet, sheet } from './sheet.ts';

/** One palette per attack kind: outline, body, light, accent. Hot, saturated hues that stay readable on every water band. */
export const AttackPalette = {
  /** Homing Squid: plum outline, magenta-pink body (no character is this hue), pale pink light, white eye and foam rim. */
  homingSquid: [0x4a0a3c, 0xff78d2, 0xffc8f0, 0xffffff],
  /** Riptide: deep green outline, sea green, mint, foam. */
  riptide: [0x06301e, 0x2cc47a, 0xb0f4c8, 0xffffff],
  /** Undertow: indigo outline, violet, lilac, white. */
  undertow: [0x14083a, 0x6a58e8, 0xc0b8ff, 0xffffff],
  /** Mimic: plum outline, lilac body, pale lilac, gold eyes. */
  mimic: [0x241838, 0xb89cf0, 0xece0ff, 0xffd23f],
} as const satisfies Record<string, Palette>;

/** The lane tile: a dark shadow line, foam streaks and mint tails, so the flow reads over a current. */
const RIPTIDE_TILE_PALETTE: Palette = [0x1c9a5c, 0xd8ffe8, 0x7fe8b0];

/** Speed lines: a violet shadow, a pale core and a brighter lead. */
const UNDERTOW_LINE_PALETTE: Palette = [0x6a58e8, 0xe8e0ff, 0xb8a8ff];

/**
 * The four attack kinds' 9x9 icon silhouettes: `0` the rim, `1` body, `2` light, `3` accent. The HUD
 * well draws them as they are with a foam rim; `worldIcon` pads them to the 12x12 the loose pickups
 * and clam pops use, with the palette's dark outline as the rim.
 */
export const ATTACK_ICON_ROWS = {
  // A squid upright: pointed mantle, two eyes, four arms.
  homingSquid: [
    '....0....',
    '...010...',
    '..01210..',
    '.0112110.',
    '.0131310.',
    '.0111110.',
    '..01110..',
    '.0101010.',
    '.0.0.0.0.',
  ],
  // Two foam-capped crests with a notch between them.
  riptide: [
    '.........',
    '..00.00..',
    '.0220220.',
    '021102110',
    '011100110',
    '011111110',
    '.0111110.',
    '..00000..',
    '.........',
  ],
  // An arrow pulling left, back down the course.
  undertow: [
    '.........',
    '...0.....',
    '..010....',
    '.01100000',
    '012211110',
    '.01100000',
    '..010....',
    '...0.....',
    '.........',
  ],
  // An octopus with gold eyes: a decoy of whoever holds it.
  mimic: [
    '..00000..',
    '.0111110.',
    '011221110',
    '013101310',
    '011111110',
    '.0111110.',
    '010101010',
    '.0.0.0.0.',
    '.........',
  ],
} as const satisfies Record<string, PixelRows>;

/** `rows` (9x9) centred in a 12x12 frame: one px of margin above and left, two below and right. */
export function worldIcon(rows: PixelRows): PixelRows {
  const blank = '.'.repeat(12);
  return [blank, ...rows.map((row) => `.${row}..`), blank, blank];
}

/** Size of one Riptide lane tile, px. */
export const RIPTIDE_TILE = 16;

/** World sheets for the squid, the lane tile and the pull lines. */
export const ATTACK_SHEETS: readonly ArtSheet[] = [
  // Pointing right with the tentacles trailing, so the view only has to rotate it to its heading.
  sheet(Tex.squid, AttackPalette.homingSquid, {
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
  sheet(Tex.riptideStreak, RIPTIDE_TILE_PALETTE, {
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
  sheet(Tex.undertowStreak, UNDERTOW_LINE_PALETTE, {
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
];
