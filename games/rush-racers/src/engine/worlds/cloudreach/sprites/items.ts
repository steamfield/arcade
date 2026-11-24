/**
 * Cloudreach's ten items drawn from code: one 9x9 silhouette per item, shown twice. The HUD well and
 * fire button get it in `SkyTex.icons` with a light rim (as Reef's `ui-icons` do, so it holds on the
 * indigo panels), and a loose pickup or burst gets it padded to the 12x12 of Reef's item sprites in
 * `SkyItemTex` with a dark outline. Rows use `0` outline, `1` body, `2` light, `3` accent; each
 * palette's comment says what those are for that item.
 */
import type { PowerUpKind } from '../../../../logic/types.ts';
import { Frame } from '../../../art/keys.ts';
import type { NamedFrame, Palette, PixelRows } from '../../../art/pixel.ts';
import { worldIcon } from '../../../art/rows.ts';
import type { ArtSheet } from '../../../art/sprites/sheet.ts';
import { ICON_RIM } from '../../../art/ui/icons.ts';
import { SkyIconFrame, SkyItemTex, SkyTex } from '../keys.ts';

/** One palette per item: outline, body, light, accent. Bright and saturated so they read on the HUD well. */
export const SkyItemPalette = {
  /** Jet Pack: near-black outline, steel tanks, a pale shine and straps, an orange flame. */
  jetFin: [0x1a1a2a, 0xa8b4cc, 0xf4f8ff, 0xff8a30],
  /** Cloud Shield: navy outline, sky-blue shield, a white cloud along its top, a white shine. */
  bubbleShield: [0x1e2a5a, 0x70b8ff, 0xf4fbff, 0xffffff],
  /** Puffball: plum outline, pink puff, a pale pink top, dark eyes. */
  puffer: [0x3a1a4a, 0xf2a0dc, 0xfff0fa, 0x3a1a4a],
  /** Smoke Bomb: near-black outline, slate bomb, a grey shine, a gold fuse spark. */
  inkSac: [0x10101a, 0x52526e, 0xa8a8c4, 0xffd040],
  /** Star Lamp: dark brown outline, brass frame, night-blue glass, a yellow star. */
  glowLantern: [0x2a1a08, 0xd8a040, 0x2c3a8a, 0xfff070],
  /** Meteor: near-black outline, brown rock, lit rock, an orange flame trail. */
  cannonball: [0x1a0e0a, 0x8a6a58, 0xc8a088, 0xff8a20],
  /** Homing Gull: navy outline, white body, grey wings, an orange beak and feet. */
  homingSquid: [0x1c2236, 0xf4f6fa, 0xa8b4c8, 0xffa030],
  /** Jet Stream: deep blue outline, bright blue arrow, a pale top edge, white speed lines. */
  riptide: [0x0e2a6a, 0x4aa8ff, 0xc8e8ff, 0xffffff],
  /** Headwind: slate outline, grey-white cloud, a white top, cyan wind lines. */
  undertow: [0x2a3456, 0xc8d4ec, 0xffffff, 0x70e0ff],
  /** Mirage: violet outline, pale lilac ghost body, a white shine, violet shimmer bands. */
  mimic: [0x2e1446, 0xc8b0ff, 0xf4eeff, 0x8a6aff],
} as const satisfies Record<PowerUpKind, Palette>;

/** The ten 9x9 silhouettes, one per item. */
const ITEM_ROWS = {
  // Two tanks joined by a buckled strap, each nozzle firing.
  jetFin: [
    '.00...00.',
    '0120.0120',
    '0110.0110',
    '011000110',
    '011020110',
    '011000110',
    '0110.0110',
    '.00...00.',
    '.33...33.',
  ],
  // A shield with a cloud along its top edge.
  bubbleShield: [
    '..00.00..',
    '.0220220.',
    '022222220',
    '013111110',
    '011111110',
    '.0111110.',
    '.0111110.',
    '..01110..',
    '...000...',
  ],
  // A round puff with two eyes.
  puffer: [
    '...000...',
    '.0022200.',
    '.0221110.',
    '021111110',
    '011313110',
    '011111110',
    '.0111110.',
    '..00000..',
    '.........',
  ],
  // A round bomb with a lit fuse.
  inkSac: [
    '.....3.3.',
    '....0.3..',
    '...000...',
    '..01110..',
    '.0121110.',
    '012211110',
    '011111110',
    '.0111110.',
    '..00000..',
  ],
  // A lantern on a ring handle with a star in its glass.
  glowLantern: [
    '...000...',
    '..0...0..',
    '.0000000.',
    '.0223220.',
    '.0333330.',
    '.0233320.',
    '.0232320.',
    '.0111110.',
    '..00000..',
  ],
  // A rock falling down and right, its flame trailing up and left.
  cannonball: [
    '3.3......',
    '.33.3....',
    '3.333....',
    '.3330000.',
    '..3022110',
    '.33021110',
    '...011110',
    '...011110',
    '....0000.',
  ],
  // A gull seen from the front, wings raised.
  homingSquid: [
    '0.......0',
    '020...020',
    '0220.0220',
    '.0221220.',
    '..01110..',
    '..011133.',
    '...0110..',
    '...3.3...',
    '.........',
  ],
  // A right-pointing arrow with speed lines at its tail.
  riptide: [
    '....0....',
    '....00...',
    '0000020..',
    '33222110.',
    '331111110',
    '33111110.',
    '0000010..',
    '....00...',
    '....0....',
  ],
  // A cloud with its mouth open on the left, blowing wind lines back.
  undertow: [
    '...00.00.',
    '..0220220',
    '..0222210',
    '33.011110',
    '333001110',
    '33.011110',
    '..0111110',
    '...00000.',
    '.........',
  ],
  // A ghost copy of a flyer facing right: a dotted outline and shimmer bands through its body.
  mimic: [
    '....0.0..',
    '...02220.',
    '0...20110',
    '.0.01110.',
    '010.11110',
    '.1111111.',
    '..13311..',
    '...113...',
    '....0....',
  ],
} as const satisfies Record<PowerUpKind, PixelRows>;

const KINDS = Object.keys(ITEM_ROWS) as PowerUpKind[];

/** A palette with its dark outline swapped for the HUD's light rim. */
const withRim = (palette: Palette): Palette => [ICON_RIM, ...palette.slice(1)];

const ICON_FRAMES: readonly NamedFrame[] = KINDS.map((kind) => ({
  name: SkyIconFrame[kind],
  palette: withRim(SkyItemPalette[kind]),
  rows: ITEM_ROWS[kind],
}));

const ITEM_SHEETS: readonly ArtSheet<string>[] = KINDS.map((kind) => ({
  key: SkyItemTex[kind],
  frames: [{ name: Frame.a, palette: SkyItemPalette[kind], rows: worldIcon(ITEM_ROWS[kind]) }],
}));

/** The 9x9 icon sheet and the ten 12x12 in-world item sheets. */
export const SKY_ITEM_SHEETS: readonly ArtSheet<string>[] = [
  { key: SkyTex.icons, frames: ICON_FRAMES },
  ...ITEM_SHEETS,
];
