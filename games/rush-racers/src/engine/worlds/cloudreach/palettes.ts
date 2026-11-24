/**
 * Cloudreach colours that its wiring reads as well as its art: the hazard palettes, whose spark and
 * body colours the object skin's dark-zone glints match.
 */
import type { Palette } from '../../art/pixel.ts';

/** Hazard palettes: dark outlines with bright bodies, so danger reads by shape and value, not hue alone. */
export const SkyHazardPalette = {
  /** Spark cloud: outline, a lit violet body that holds 3:1 off the sky, yellow sparks. */
  sparkCloud: [0x1a1030, 0xc0a8e8, 0xfff060],
  /** Static wisp: outline, ice-blue body, white crackle. */
  staticWisp: [0x1a2448, 0x9ad8ff, 0xf4fcff],
} as const satisfies Record<string, Palette>;
