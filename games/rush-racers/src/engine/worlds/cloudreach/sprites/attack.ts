/**
 * Cloudreach's attack art that lives in the world rather than the HUD: the homing gull (wing beats and
 * a latched pose), one tile of a jet stream lane, the headwind's gust lines, the smoke cloud, the
 * cloud-shield bubble and the glow under a loose item. Each matches the size of its Reef counterpart
 * so the views place it the same way.
 */
import { Frame } from '../../../art/keys.ts';
import type { Palette } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { SkyTex } from '../keys.ts';
import { SkyItemPalette } from './items.ts';

/** The jet stream lane tile: a blue shadow line, white streaks and cyan chevron tips. */
const JET_STREAM_TILE_PALETTE: Palette = [0x2a62b8, 0xf0f8ff, 0x80d8ff];

/** Headwind gusts: a slate shadow, a pale core and a sky-blue lead. */
const HEADWIND_LINE_PALETTE: Palette = [0x5a78a8, 0xf0f4ff, 0xa8ccff];

/** Smoke cloud: a grey core and a paler dithered edge, so it reads against the deep blue sky. */
const SMOKE_CLOUD_PALETTE: Palette = [0x5a5a6c, 0x9a9aae];

/** Cloud-shield bubble: a pale sky-blue scalloped rim and a white shine. */
const CLOUD_BUBBLE_PALETTE: Palette = [0xc8ecff, 0xffffff];

/** Loose glow: a ring of warm gold twinkles and white sparkles. */
const LOOSE_GLOW_PALETTE: Palette = [0xfff0b0, 0xffffff];

const GULL_SHEET = sheet(SkyTex.gull, SkyItemPalette.homingSquid, {
  // Pointing right: wing raised behind the head, forked tail at the left, orange beak.
  [Frame.a]: [
    '................',
    '.....00.........',
    '.....0220.......',
    '......02220.....',
    '.......02220....',
    '.00.....0220000.',
    '0110000002211010',
    '.011111111111133',
    '..011111111110..',
    '...0000000000...',
    '................',
    '................',
  ],
  // Wing swept down under the body.
  [Frame.b]: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.00........0000.',
    '0110000000011010',
    '.011111111111133',
    '..011112221110..',
    '...0002220000...',
    '....02220.......',
    '....000.........',
  ],
  // Clamped on the racer's head: wings draped down both sides, feet gripping below.
  [Frame.squidLatched]: [
    '......0000......',
    '.....011010.....',
    '.....0111133....',
    '..000011110000..',
    '.02220111102220.',
    '0222201111022220',
    '0222011111102220',
    '0220111111110220',
    '0200011111100020',
    '00..00000000..00',
    '.....3....3.....',
    '................',
  ],
});

const JET_STREAM_SHEET = sheet(SkyTex.jetStreamStreak, JET_STREAM_TILE_PALETTE, {
  [Frame.a]: [
    '................',
    '.........1......',
    '22221111111.....',
    '0000000001......',
    '................',
    '................',
    '..............1.',
    '.....22221111111',
    '.....0000000001.',
    '................',
    '................',
    '...........1....',
    '..22221111111...',
    '..0000000001....',
    '................',
    '................',
  ],
});

const HEADWIND_SHEET = sheet(SkyTex.headwindStreak, HEADWIND_LINE_PALETTE, {
  // Gust lines, each curling up at its far end.
  [Frame.a]: [
    '...........11...',
    '22211111111..1..',
    '00000000000.1...',
    '................',
    '................',
    '......221111111.',
    '......000000000.',
    '................',
    '.2221111111111..',
    '.0000000000000..',
  ],
  [Frame.b]: [
    '................',
    '................',
    '....222111111111',
    '....000000000000',
    '................',
    '11.....2211111..',
    '00.....0000000..',
    '...........11...',
    '...22211111..1..',
    '...00000000.1...',
  ],
});

const SMOKE_SHEET = sheet(SkyTex.smokeCloud, SMOKE_CLOUD_PALETTE, {
  [Frame.a]: [
    '........................',
    '.......1.1.1............',
    '.....1.00000.1..1.1.....',
    '...1.00000000.1.00000.1.',
    '..1.00000000000000000.1.',
    '...0000000000000000000..',
    '.1.00000000000000000000.',
    '..000000000000000000000.',
    '.1000000000000000000001.',
    '..000000000000000000000.',
    '.10000000000000000000.1.',
    '..10000000000000000001..',
    '...1.000000.10000.1.1...',
    '.....1.1000.1.1.1.......',
    '.......1.1..............',
    '........................',
  ],
});

const CLOUD_BUBBLE_SHEET = sheet(SkyTex.cloudBubble, CLOUD_BUBBLE_PALETTE, {
  // A scalloped ring, like the edge of a cloud.
  [Frame.a]: [
    '.00.00.00.',
    '0..0..0..0',
    '0.11.....0',
    '.01.....0.',
    '0........0',
    '0........0',
    '.0......0.',
    '0........0',
    '0..0..0..0',
    '.00.00.00.',
  ],
});

const LOOSE_GLOW_SHEET = sheet(SkyTex.looseGlow, LOOSE_GLOW_PALETTE, {
  [Frame.a]: [
    '.......1........',
    '....0.111.0.....',
    '...0...1...0....',
    '..0.........0...',
    '.0...........0..',
    '................',
    '.1...........1..',
    '111.........111.',
    '.1...........1..',
    '................',
    '.0...........0..',
    '..0.........0...',
    '...0...1...0....',
    '....0.111.0.....',
    '.......1........',
    '................',
  ],
});

/** World sheets for the gull, jet stream, headwind, smoke cloud, cloud bubble and loose glow. */
export const SKY_ATTACK_SHEETS: readonly ArtSheet<string>[] = [
  GULL_SHEET,
  JET_STREAM_SHEET,
  HEADWIND_SHEET,
  SMOKE_SHEET,
  CLOUD_BUBBLE_SHEET,
  LOOSE_GLOW_SHEET,
];
