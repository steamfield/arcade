/**
 * The colours of the global art, as named palettes of at most 4 colours per sprite (index 0 is
 * digit `0` in the pixel text). A world's cast and object colours live in its folder under
 * `worlds/`, and a theme's in its folder under `themes/`.
 */
import type { Palette } from './pixel.ts';

/** HUD sprite palettes. */
export const HudPalette = {
  /** Kick pip: outline, ready glow, ready core. Cooling uses the outline only, so state reads by shape too. */
  kickPip: [0x2a4a6a, 0x7fdbff, 0xe0f8ff],
} as const satisfies Record<string, Palette>;
