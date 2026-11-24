/**
 * Reef's ten in-world item sprites (12x12, each its own shape: fin, bubble, puffer, ink drop,
 * lantern, squid, wave, pull arrow, octopus, cannonball), shown as a loose pickup or a clam's burst.
 * The palettes and the four attack kinds' silhouettes are shared with Reef's HUD icons in
 * `icons.ts`, so a kind keeps one colour and shape everywhere.
 */
import type { PowerUpKind } from '../../../../logic/types.ts';
import { Frame } from '../../../art/keys.ts';
import type { Palette, PixelRows } from '../../../art/pixel.ts';
import { worldIcon } from '../../../art/rows.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { ReefItemTex } from '../keys.ts';

/**
 * One palette per item: outline, body, light, accent. Bright and warm against the blue water; the
 * attack kinds take hot, saturated hues that stay readable on every water band.
 */
export const ReefItemPalette = {
  /** Jet Fins: outline, blue, light, white. */
  jetFin: [0x0c1e3a, 0x2b8ce0, 0x9ad8ff, 0xffffff],
  /** Bubble Shield: outline, aqua, light, white. */
  bubbleShield: [0x0c2e3a, 0x3cc4d8, 0xb8f4ff, 0xffffff],
  /** Puffer: outline, yellow, light, spines. */
  puffer: [0x3a2008, 0xf0b030, 0xffe890, 0xa05a14],
  /** Ink Sac: outline, ink, sheen, white highlight. */
  inkSac: [0x0a0614, 0x3c2a66, 0x7a64b0, 0xffffff],
  /** Glow Lantern: outline, frame, glow, white core. */
  glowLantern: [0x2a1a08, 0x8a5a20, 0xffe060, 0xffffff],
  /** Cannonball: outline, iron, shine, the lit fuse's spark. */
  cannonball: [0x101018, 0x4a4e66, 0xb4bcd4, 0xff8a30],
  /** Homing Squid: plum outline, magenta-pink body (no character is this hue), pale pink light, white eye and foam rim. */
  homingSquid: [0x4a0a3c, 0xff78d2, 0xffc8f0, 0xffffff],
  /** Riptide: deep green outline, sea green, mint, foam. */
  riptide: [0x06301e, 0x2cc47a, 0xb0f4c8, 0xffffff],
  /** Undertow: indigo outline, violet, lilac, white. */
  undertow: [0x14083a, 0x6a58e8, 0xc0b8ff, 0xffffff],
  /** Mimic: plum outline, lilac body, pale lilac, gold eyes. */
  mimic: [0x241838, 0xb89cf0, 0xece0ff, 0xffd23f],
} as const satisfies Record<PowerUpKind, Palette>;

/**
 * The four attack kinds' 9x9 icon silhouettes: `0` the rim, `1` body, `2` light, `3` accent. The HUD
 * well draws them as they are with a foam rim; `worldIcon` pads them to the 12x12 the loose pickups
 * and clam pops use, with the palette's dark outline as the rim.
 */
export const REEF_ATTACK_ICON_ROWS = {
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

/** The ten in-world item sheets, one 12x12 frame `a` per item. */
export const REEF_ITEM_SHEETS: readonly ArtSheet<string>[] = [
  sheet(ReefItemTex.jetFin, ReefItemPalette.jetFin, {
    [Frame.a]: [
      '............',
      '............',
      '.000........',
      '0110000.....',
      '01211110000.',
      '011212122210',
      '011121212110',
      '012111111110',
      '01112222220.',
      '.0110000....',
      '..00........',
      '............',
    ],
  }),
  sheet(ReefItemTex.bubbleShield, ReefItemPalette.bubbleShield, {
    [Frame.a]: [
      '............',
      '...000000...',
      '..01122110..',
      '.0133222210.',
      '.0132222210.',
      '.0222222220.',
      '.0222222220.',
      '.0122222210.',
      '.0122222310.',
      '..01122110..',
      '...000000...',
      '............',
    ],
  }),
  sheet(ReefItemTex.puffer, ReefItemPalette.puffer, {
    [Frame.a]: [
      '..0..030.0..',
      '.0300000030.',
      '.0001111000.',
      '030122111030',
      '.0111111010.',
      '.0111111110.',
      '001111111100',
      '301222222103',
      '0.02222220.0',
      '...011110...',
      '...000000...',
      '..030..030..',
    ],
  }),
  sheet(ReefItemTex.inkSac, ReefItemPalette.inkSac, {
    [Frame.a]: [
      '.....00.....',
      '....0110....',
      '....0110....',
      '...011110...',
      '..01111110..',
      '.0113211110.',
      '.0112111110.',
      '.0112111110.',
      '.0111111110.',
      '..01111110..',
      '...011110...',
      '....0000....',
    ],
  }),
  sheet(ReefItemTex.glowLantern, ReefItemPalette.glowLantern, {
    [Frame.a]: [
      '............',
      '....0000....',
      '...000000...',
      '..01111110..',
      '..01223210..',
      '..01233310..',
      '..01233310..',
      '..01223210..',
      '..01111110..',
      '...011110...',
      '....0000....',
      '............',
    ],
  }),
  sheet(ReefItemTex.cannonball, ReefItemPalette.cannonball, {
    [Frame.a]: [
      '.........3..',
      '........3.3.',
      '.......0.3..',
      '...00000....',
      '..0111110...',
      '.012211110..',
      '.012111110..',
      '.011111110..',
      '.011111110..',
      '..0111110...',
      '...00000....',
      '............',
    ],
  }),
  sheet(ReefItemTex.homingSquid, ReefItemPalette.homingSquid, {
    [Frame.a]: worldIcon(REEF_ATTACK_ICON_ROWS.homingSquid),
  }),
  sheet(ReefItemTex.riptide, ReefItemPalette.riptide, { [Frame.a]: worldIcon(REEF_ATTACK_ICON_ROWS.riptide) }),
  sheet(ReefItemTex.undertow, ReefItemPalette.undertow, { [Frame.a]: worldIcon(REEF_ATTACK_ICON_ROWS.undertow) }),
  sheet(ReefItemTex.mimic, ReefItemPalette.mimic, { [Frame.a]: worldIcon(REEF_ATTACK_ICON_ROWS.mimic) }),
];
