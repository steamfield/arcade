/**
 * Farside's ten items drawn from code: one 9x9 silhouette per item, shown twice. The HUD well and
 * fire button get it in `FarTex.icons` with a light rim (as Reef's `ui-icons` do, so it holds on the
 * indigo panels), and a loose pickup or burst gets it padded to the 12x12 of Reef's item sprites in
 * `FarItemTex` with a dark outline. Rows use `0` outline, `1` body, `2` light, `3` accent.
 */
import type { PowerUpKind } from '../../../../logic/types.ts';
import { Frame } from '../../../art/keys.ts';
import type { NamedFrame, Palette, PixelRows } from '../../../art/pixel.ts';
import { worldIcon } from '../../../art/rows.ts';
import type { ArtSheet } from '../../../art/sprites/sheet.ts';
import { ICON_RIM } from '../../../art/ui/icons.ts';
import { FarIconFrame, FarItemTex, FarTex } from '../keys.ts';

/** One palette per item: outline, body, light, accent. Bright and saturated so they read on the HUD well and the dark sky. */
export const FarItemPalette = {
  /** Ion Thrusters: navy outline, steel pods, pale steel shine, an orange flame. */
  jetFin: [0x14182a, 0x8a96aa, 0xdde6f2, 0xffa030],
  /** Force Field: deep green outline, green field, mint shine, a pale hex cell. */
  bubbleShield: [0x0a2a18, 0x30c070, 0xa0ffc8, 0xe8fff0],
  /** Shock Bubble: deep violet outline, violet ball, lilac shine, yellow sparks. */
  puffer: [0x200a3a, 0x9a50ff, 0xe0c0ff, 0xfff070],
  /** Gas Bomb: dark olive outline, mustard canister, pale shine, brown hazard stripes. */
  inkSac: [0x241a04, 0xd8b030, 0xfff0a0, 0x5a3a08],
  /** Star Flare: dark amber outline, gold star, pale gold, a white core. */
  glowLantern: [0x3a2404, 0xffc020, 0xfff080, 0xffffff],
  /** Comet: dark rust outline, orange head, pale gold shine, an amber tail. */
  cannonball: [0x2a0e04, 0xff7a20, 0xffd070, 0xffa848],
  /** Homing Probe: near-black outline and panel lines, silver body, white shine, a red eye. */
  homingSquid: [0x10141e, 0xa8b0c0, 0xeef2ff, 0xff3a3a],
  /** Ion Stream: navy outline, blue chevrons, pale blue, white tips. */
  riptide: [0x0a1a4a, 0x3a8aff, 0xa8d8ff, 0xffffff],
  /** Tractor Beam: deep plum outline, lavender saucer, pale blue dome, a pink beam. */
  undertow: [0x1a1030, 0x9aa0c8, 0xd0f0ff, 0xff60c0],
  /** Hologram: dark teal base, cyan figure, pale cyan scan lines, a teal projector. */
  mimic: [0x0a2a36, 0x40e0f0, 0xc0fcff, 0x1a7a90],
} as const satisfies Record<PowerUpKind, Palette>;

/** The ten 9x9 silhouettes, one per item. */
const ITEM_ROWS = {
  // Two steel thruster pods on a crossbar, flames out of both nozzles.
  jetFin: [
    '.00...00.',
    '0120.0120',
    '0120.0120',
    '011000110',
    '0110.0110',
    '.00...00.',
    '.33...33.',
    '.333.333.',
    '..3...3..',
  ],
  // A green hexagon with a small hex cell in its middle.
  bubbleShield: [
    '..00000..',
    '.0122210.',
    '012111110',
    '011333110',
    '013111310',
    '011333110',
    '011111110',
    '.0111110.',
    '..00000..',
  ],
  // A violet ball throwing sparks at the corners and edges.
  puffer: [
    '3...3...3',
    '.3.000.3.',
    '..02210..',
    '.0221110.',
    '302111103',
    '.0111110.',
    '..01110..',
    '.3.000.3.',
    '3...3...3',
  ],
  // A gas canister with a valve on top and a striped hazard band.
  inkSac: [
    '...000...',
    '..00200..',
    '.0122110.',
    '.0121110.',
    '.0313130.',
    '.0131310.',
    '.0111110.',
    '.0111110.',
    '..00000..',
  ],
  // A gold star burst with a white core and four short rays between its points, the rays and tips pale so they show on the dark sky.
  glowLantern: [
    '....2....',
    '.2..1..2.',
    '..01210..',
    '.0122210.',
    '212232212',
    '.0122210.',
    '..01210..',
    '.2..1..2.',
    '....2....',
  ],
  // An orange comet head at the top right with its tail streaming down to the left.
  cannonball: [
    '.....000.',
    '....01220',
    '...301120',
    '..3301110',
    '.333.000.',
    '3333.....',
    '333......',
    '33.......',
    '3........',
  ],
  // A silver probe between two striped solar panels, its red eye in the middle.
  homingSquid: [
    '....0....',
    '..00000..',
    '000121000',
    '220111022',
    '000131000',
    '220111022',
    '000111000',
    '..00000..',
    '...0.0...',
  ],
  // Two chevrons pointing right, white at the tips.
  riptide: [
    '00..00...',
    '120.120..',
    '.120.120.',
    '..120.120',
    '...33..33',
    '..120.120',
    '.120.120.',
    '120.120..',
    '00..00...',
  ],
  // A saucer with a domed top, a row of lights and a pink beam fanning down.
  undertow: [
    '...000...',
    '..02220..',
    '.0000000.',
    '011111110',
    '013131310',
    '.0000000.',
    '...333...',
    '..3.3.3..',
    '.3.3.3.3.',
  ],
  // A cyan figure in scan lines standing on its projector.
  mimic: [
    '...111...',
    '..12221..',
    '..11111..',
    '...222...',
    '.1111111.',
    '.2222222.',
    '.1111111.',
    '..33333..',
    '.0000000.',
  ],
} as const satisfies Record<PowerUpKind, PixelRows>;

const KINDS = Object.keys(ITEM_ROWS) as PowerUpKind[];

/** A palette with its dark outline swapped for the HUD's light rim. */
const withRim = (palette: Palette): Palette => [ICON_RIM, ...palette.slice(1)];

const ICON_FRAMES: readonly NamedFrame[] = KINDS.map((kind) => ({
  name: FarIconFrame[kind],
  palette: withRim(FarItemPalette[kind]),
  rows: ITEM_ROWS[kind],
}));

const ITEM_SHEETS: readonly ArtSheet<string>[] = KINDS.map((kind) => ({
  key: FarItemTex[kind],
  frames: [{ name: Frame.a, palette: FarItemPalette[kind], rows: worldIcon(ITEM_ROWS[kind]) }],
}));

/** The 9x9 icon sheet and the ten 12x12 in-world item sheets. */
export const ITEM_ART_SHEETS: readonly ArtSheet<string>[] = [
  { key: FarTex.icons, frames: ICON_FRAMES },
  ...ITEM_SHEETS,
];
