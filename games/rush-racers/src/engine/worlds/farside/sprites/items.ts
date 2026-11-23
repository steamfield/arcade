/**
 * Farside's ten items drawn from code: one 9x9 silhouette per item, shown twice. The HUD well and
 * fire button get it in `FarTex.icons` with a light rim (as Reef's `ui-icons` do, so it holds on the
 * indigo panels), and a loose pickup or burst gets it padded to the 12x12 of Reef's item sprites in
 * `FarItemTex` with a dark outline. Rows use `0` outline, `1` body, `2` light, `3` accent.
 */
import type { PowerUpKind } from '../../../../logic/types.ts';
import { Frame } from '../../../art/keys.ts';
import type { NamedFrame, Palette, PixelRows } from '../../../art/pixel.ts';
import { worldIcon } from '../../../art/sprites/attack.ts';
import type { ArtSheet } from '../../../art/sprites/sheet.ts';
import { ICON_RIM } from '../../../art/ui/icons.ts';
import { FarIconFrame, FarItemTex, FarTex } from '../keys.ts';

/** One palette per item: outline, body, light, accent. Warm and saturated so they read on the HUD well. */
export const FarItemPalette = {
  /** Rocket Boots: dark leather outline, red boot, peach light, a yellow flame. */
  jetFin: [0x2a1008, 0xe0482a, 0xffb070, 0xffe040],
  /** Sap Shield: dark brown outline, amber sap, pale gold light, a white shine. */
  bubbleShield: [0x2a1a04, 0xf0a020, 0xffe080, 0xffffff],
  /** Burr Ball: dark brown outline, chestnut body, tan spines, a darker seed. */
  puffer: [0x2a1608, 0xb87030, 0xf0c078, 0x6a3a14],
  /** Mud Pie: near-black outline, brown mud, wet shine, a cream crust. */
  inkSac: [0x140a04, 0x7a5232, 0xb88a58, 0xf0dcb0],
  /** Firefly Jar: dark teal outline, glass, pale glass light, a yellow glow. */
  glowLantern: [0x10242a, 0x5ca8a0, 0xc8f0e8, 0xffe860],
  /** Boulder: near-black outline, grey stone, pale stone, a moss patch. */
  cannonball: [0x16161e, 0x7a7a8a, 0xc0c0d0, 0x4a9a3a],
  /** Homing Probe: dark outline and stripes, orange body, yellow light, white wings. */
  homingSquid: [0x1a1206, 0xff9a20, 0xffe070, 0xffffff],
  /** Tailwind: deep green outline, leaf green, pale green, white gust. */
  riptide: [0x0a3a28, 0x58d8a0, 0xd0fff0, 0xffffff],
  /** Snare Vine: deep green outline, vine green, lime light, a pink thorn flower. */
  undertow: [0x0c2a0c, 0x3ea838, 0xa8e868, 0xf0509a],
  /** Copycat: plum outline, lilac fur, pale lilac, gold eyes. */
  mimic: [0x241838, 0xb89cf0, 0xece0ff, 0xffd23f],
} as const satisfies Record<PowerUpKind, Palette>;

/** The ten 9x9 silhouettes, one per item. */
const ITEM_ROWS = {
  // A boot facing right with a flame under the heel.
  jetFin: [
    '..000....',
    '..010....',
    '..010....',
    '..0110...',
    '.01111000',
    '011112210',
    '011111110',
    '000000000',
    '.33.3....',
  ],
  // A heater shield of amber sap with a shine.
  bubbleShield: [
    '.0000000.',
    '012222210',
    '012322110',
    '011222110',
    '011111110',
    '.0111110.',
    '.0111110.',
    '..01110..',
    '...000...',
  ],
  // A round chestnut bristling with spines.
  puffer: [
    '0...0...0',
    '.0.020.0.',
    '..02120..',
    '001121100',
    '001111100',
    '.0113110.',
    '..01110..',
    '.0.010.0.',
    '0...0...0',
  ],
  // A mud mound on a crust.
  inkSac: [
    '....0....',
    '...000...',
    '..01210..',
    '.0112110.',
    '.0111110.',
    '000000000',
    '032323230',
    '.0333330.',
    '..00000..',
  ],
  // A jar with a lid and a glowing bug.
  glowLantern: [
    '..00000..',
    '..02220..',
    '.0121110.',
    '011133110',
    '011333110',
    '011133110',
    '011111110',
    '.0111110.',
    '..00000..',
  ],
  // A round grey stone with moss at its foot.
  cannonball: [
    '..00000..',
    '.0122110.',
    '012221110',
    '012211110',
    '011111110',
    '011111110',
    '033311110',
    '.0111110.',
    '..00000..',
  ],
  // A probe seen from the side, wings up.
  homingSquid: [
    '.33...33.',
    '.3333333.',
    '..00000..',
    '.0121210.',
    '.0010100.',
    '.0111110.',
    '..00100..',
    '....0....',
    '.........',
  ],
  // Three gust lines curling right.
  riptide: [
    '.........',
    '.00000...',
    '0122210..',
    '.0000010.',
    '..0000210',
    '.0222210.',
    '0111100..',
    '.0000....',
    '.........',
  ],
  // A vine that loops back on itself with a thorn flower.
  undertow: [
    '.....000.',
    '..0000130',
    '.0112210.',
    '01100000.',
    '0120.....',
    '01100000.',
    '.0112210.',
    '..0000110',
    '.....000.',
  ],
  // A cat's head with pointed ears and gold eyes.
  mimic: [
    '0.0...0.0',
    '010000010',
    '011111110',
    '013101310',
    '011111110',
    '011202110',
    '.0111110.',
    '..00000..',
    '.........',
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
