/**
 * Farside's attack art that lives in the world rather than the HUD: the homing probe (flight strokes
 * and a latched pose), one tile of a tailwind lane, the snare vine's speed streaks, the mud cloud,
 * the sap bubble and the glow under a loose item. Each matches the size of its Reef counterpart so
 * the views place it the same way.
 */
import { Frame } from '../../../art/keys.ts';
import type { Palette } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { FarTex } from '../keys.ts';
import { FarItemPalette } from './items.ts';

/** The tailwind lane tile: a dark green shadow line, white streaks and mint tails. */
const TAILWIND_TILE_PALETTE: Palette = [0x1c8a5c, 0xe8fff0, 0x88f0c0];

/** Snare streaks: a green shadow, a pale core and a lime lead. */
const SNARE_LINE_PALETTE: Palette = [0x3ea838, 0xe8ffd0, 0xb0f070];

/** Mud cloud: core and dithered edge, brown so it reads against the green canopy. */
const MUD_CLOUD_PALETTE: Palette = [0x2a1a0c, 0x5a4026];

/** Sap bubble: amber rim and a pale shine. */
const SAP_BUBBLE_PALETTE: Palette = [0xffd060, 0xffffff];

/** Loose glow: two dithered rings, a warm green-gold. */
const LOOSE_GLOW_PALETTE: Palette = [0xf0f0a0, 0xffffff];

const BEE_SHEET = sheet(FarTex.probe, FarItemPalette.homingSquid, {
  // Pointing right: wings up, striped body, stinger trailing left.
  [Frame.a]: [
    '................',
    '....3333........',
    '...333333.......',
    '....33333.000...',
    '.0..0001000110..',
    '000.01110001210.',
    '.0..01210111110.',
    '....0111000110..',
    '.....000.000....',
    '................',
    '................',
    '................',
  ],
  // Wings down.
  [Frame.b]: [
    '................',
    '................',
    '................',
    '........0.0.....',
    '.0..0001000110..',
    '000.01110001210.',
    '.0..01210111110.',
    '....0111000110..',
    '....3333.000....',
    '...333333.......',
    '....3333........',
    '................',
  ],
  // Wrapped round the racer's head: a ring of stripes with a white rim, like the squid's latched pose.
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
});

const TAILWIND_SHEET = sheet(FarTex.ionStreak, TAILWIND_TILE_PALETTE, {
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
});

const SNARE_SHEET = sheet(FarTex.tractorStreak, SNARE_LINE_PALETTE, {
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
});

const MUD_SHEET = sheet(FarTex.gasCloud, MUD_CLOUD_PALETTE, {
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
});

const SAP_BUBBLE_SHEET = sheet(FarTex.fieldBubble, SAP_BUBBLE_PALETTE, {
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
});

const LOOSE_GLOW_SHEET = sheet(FarTex.looseGlow, LOOSE_GLOW_PALETTE, {
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
});

/** World sheets for the probe, tailwind, snare vine, mud cloud, sap bubble and loose glow. */
export const ATTACK_ART_SHEETS: readonly ArtSheet<string>[] = [
  BEE_SHEET,
  TAILWIND_SHEET,
  SNARE_SHEET,
  MUD_SHEET,
  SAP_BUBBLE_SHEET,
  LOOSE_GLOW_SHEET,
];
