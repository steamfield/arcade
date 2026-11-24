/**
 * Reef's item colours and attack silhouettes, shared by the in-world item sprites (`items.ts`) and
 * the HUD icons (`icons.ts`). Kept apart from both so the UI kit's icons can be built without
 * loading Reef's item sheets.
 */
import type { PowerUpKind } from '../../../../logic/types.ts';
import type { Palette, PixelRows } from '../../../art/pixel.ts';

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
