/**
 * Farside's attack art that lives in the world rather than the HUD: the homing probe (two flight
 * frames and a pose clamped on a racer's head), one tile of an ion stream lane, the tractor beam's
 * pull lines, the gas cloud, the force field bubble and the glow under a loose item. Each matches the
 * size of its Reef counterpart so the views place it the same way.
 */
import { Frame } from '../../../art/keys.ts';
import type { Palette } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { FarTex } from '../keys.ts';
import { FarItemPalette } from './items.ts';

/** The ion stream lane tile: the faded far end of each tail, blue chevrons and the pale blue tails. */
const ION_TILE_PALETTE: Palette = [0x2a5ad8, 0x80c0ff, 0xd8ecff];

/** Tractor pull lines: a magenta shadow, a pale pink core and a pink lead. */
const TRACTOR_LINE_PALETTE: Palette = [0xc03890, 0xffe0f4, 0xff70c8];

/** Gas cloud: core and dithered edge, a dull mustard that hides what is under it on the dark sky. */
const GAS_CLOUD_PALETTE: Palette = [0x4a4010, 0x9a8a28];

/** Force field: green rim and a pale shine. */
const FIELD_BUBBLE_PALETTE: Palette = [0x60ffa0, 0xe8fff0];

/** Loose glow: an outer ring of dots and inner twinkles, near white so the views can tint it. */
const LOOSE_GLOW_PALETTE: Palette = [0xd0e8ff, 0xffffff];

const PROBE_SHEET = sheet(FarTex.probe, FarItemPalette.homingSquid, {
  // Pointing right: a panel above and below the body, red eye at the nose, an ion trail behind.
  [Frame.a]: [
    '......00000.....',
    '......02220.....',
    '......00000.....',
    '........0.......',
    '....00000000....',
    '2.2.012211130...',
    '.2..011111130...',
    '....00000000....',
    '........0.......',
    '......00000.....',
    '......02220.....',
    '......00000.....',
  ],
  // The panels catch the light the other way and the trail flickers.
  [Frame.b]: [
    '......00000.....',
    '......02020.....',
    '......00000.....',
    '........0.......',
    '....00000000....',
    '.2.2012211130...',
    '2...011111130...',
    '....00000000....',
    '........0.......',
    '......00000.....',
    '......02020.....',
    '......00000.....',
  ],
  // Clamped on a racer's head: panels spread to the sides, eye glaring down, pale claws gripping so they show on a dark racer.
  [Frame.squidLatched]: [
    '....00000000....',
    '0000012211100000',
    '0220011111100220',
    '0000011331100000',
    '....01111110....',
    '....00000000....',
    '....2......2....',
    '...22......22...',
    '...2........2...',
    '....2......2....',
    '................',
    '................',
  ],
});

const ION_STREAM_SHEET = sheet(FarTex.ionStreak, ION_TILE_PALETTE, {
  // Three chevrons pointing downstream with their tails, kept off the edges so the tile repeats cleanly.
  [Frame.a]: [
    '................',
    '....1...........',
    '.....1..........',
    '0222..1.........',
    '.....1..........',
    '....1...........',
    '...........1....',
    '............1...',
    '.......0222..1..',
    '............1...',
    '...........1....',
    '.....1..........',
    '......1.........',
    '.0222..1........',
    '......1.........',
    '.....1..........',
  ],
});

const TRACTOR_SHEET = sheet(FarTex.tractorStreak, TRACTOR_LINE_PALETTE, {
  [Frame.a]: [
    '................',
    '.2211111........',
    '.0000000........',
    '......221111111.',
    '......000000000.',
    '..22211.........',
    '..00000.........',
    '.....2221111....',
    '.....0000000....',
    '................',
  ],
  [Frame.b]: [
    '................',
    '......2211111...',
    '......0000000...',
    '1111.......22111',
    '0000.......00000',
    '.......22211....',
    '.......00000....',
    '2221111.........',
    '0000000.........',
    '................',
  ],
});

const GAS_SHEET = sheet(FarTex.gasCloud, GAS_CLOUD_PALETTE, {
  // Four overlapping puffs with a dithered edge.
  [Frame.a]: [
    '.............1.1........',
    '..........1.1.1.1.......',
    '.........1.0000001......',
    '......1.10000000001.....',
    '.....1.0000000000001....',
    '....100000000000000.1...',
    '...10000000000000001....',
    '..1.00000000000000001...',
    '...0000000000000000001..',
    '..1000000000000000000.1.',
    '...1000000000000000001..',
    '..1.00000000000000000...',
    '...1.0000001.1000000.1..',
    '....1.100.1.1.10000.1...',
    '.....1.1.1.....1.1.1....',
    '................1.......',
  ],
});

const FIELD_SHEET = sheet(FarTex.fieldBubble, FIELD_BUBBLE_PALETTE, {
  // An eight-sided field with a shine at its top left.
  [Frame.a]: [
    '..000000..',
    '.0......0.',
    '0.11.....0',
    '0.1......0',
    '0........0',
    '0........0',
    '0........0',
    '0........0',
    '.0......0.',
    '..000000..',
  ],
});

const LOOSE_GLOW_SHEET = sheet(FarTex.looseGlow, LOOSE_GLOW_PALETTE, {
  // A ring of dots with a twinkle at each diagonal.
  [Frame.a]: [
    '.......00.......',
    '....0......0....',
    '..0..........0..',
    '...1........1...',
    '.0..1......1..0.',
    '................',
    '................',
    '0..............0',
    '0..............0',
    '................',
    '................',
    '.0..1......1..0.',
    '...1........1...',
    '..0..........0..',
    '....0......0....',
    '.......00.......',
  ],
});

/** World sheets for the probe, ion stream, tractor beam, gas cloud, force field and loose glow. */
export const ATTACK_ART_SHEETS: readonly ArtSheet<string>[] = [
  PROBE_SHEET,
  ION_STREAM_SHEET,
  TRACTOR_SHEET,
  GAS_SHEET,
  FIELD_SHEET,
  LOOSE_GLOW_SHEET,
];
