/**
 * Reef's cast colours: four per slot, shared by the racers in `racers.ts` and the portraits and
 * heads in `portraits.ts`, so a racer looks the same in the water, on the strip and on the podium.
 */
import type { CharacterId } from '../../../../logic/types.ts';
import type { Palette } from '../../../art/pixel.ts';

/**
 * Each slot's palette: outline, main, second, accent. The main colour holds 3:1 against every
 * theme's contrast bands so the racer reads in any depth (`art/sprites/sprites.test.ts`). The second
 * is the other body tone: a pale belly, glint or shell for most, but Onyx's charcoal back, the one
 * second colour darker than its main.
 */
export const ReefPalette = {
  /** Brass helmet, pale glints, red snapper body behind the porthole. */
  rudy: [0x2a1008, 0xffc040, 0xfff2c0, 0xf05038],
  /** Seahorse green, pale belly plates, deep green ridges. */
  gil: [0x0c2a14, 0x7ad860, 0xe0ffa0, 0x2e8a44],
  /** Electric blue, ice-white belly and sail spots, a yellow lightning stripe. */
  streak: [0x0a1040, 0x3cb8ff, 0xd8f6ff, 0xffe040],
  /** Silver rim and belly framing a charcoal-black back, a red eye and a red scar on the fin tip. */
  onyx: [0x06060c, 0xc4cadc, 0x46445e, 0xff3048],
  /** Cream shell, red cleaner stripes, cyan goggle lenses. */
  nib: [0x3a0a14, 0xfff0e2, 0xff4a4a, 0x5ae2ff],
  /** Rust-orange shell; cream legs and barnacles, so the legs still read over coral; a gold crown. */
  baron: [0x220a08, 0xf08c50, 0xfff0d0, 0xffd040],
  /** Pale moon bell, white starlight, periwinkle rings and tentacles. */
  selene: [0x241a5c, 0xd0d8ff, 0xffffff, 0x9a8cff],
  /** Shark grey, white belly and teeth, yellow hunter's eyes. */
  rook: [0x0a1626, 0x9aaec4, 0xeef4fa, 0xffd23a],
} as const satisfies Record<CharacterId, Palette>;
