/**
 * Farside's cast colours: four per slot, shared by the racers in `racers.ts` and the portraits and
 * heads in `portraits.ts`, so a racer looks the same on the course, on the strip and on the
 * select screen.
 */
import type { CharacterId } from '../../../../logic/types.ts';
import type { Palette } from '../../../art/pixel.ts';

/**
 * Each slot's palette: outline, main, second, accent. The main colour holds 3:1 against every
 * theme's contrast bands so the racer reads in any light (`sprites.test.ts`). The outline is
 * near-black and vanishes on the space sky, so anything that has to read (limbs, antennae, eyes)
 * is drawn in the other three. The second is the other body tone: glass, a pale belly or a glow
 * for most, but Umbra's charcoal hull, the one second colour darker than its main.
 */
export const FarsidePalette = {
  /** Bolt: coral-red plating, a pale blue glass dome, yellow lamp eyes and thruster flame. */
  rudy: [0x2a0a10, 0xff806c, 0xc8f0ff, 0xffd23a],
  /** Zib: lime skin, pale green eyes and belly, pink antenna tips. */
  gil: [0x0c2410, 0x7ce85a, 0xe8ffd0, 0xff5ac8],
  /** Flare: sky-blue skin, a white-hot tail core and eyes, an orange tail flame. */
  streak: [0x0a1838, 0x5ab4ff, 0xeaf8ff, 0xffa03c],
  /** Umbra: a teal sheen on the lit edges of a charcoal hull, one amber eye. */
  onyx: [0x05060c, 0x8ac8d4, 0x1c2230, 0xffb020],
  /** Widget: lilac skin, a cream backpack, mint goggle lenses and jet. */
  nib: [0x24103a, 0xc898ff, 0xfff0e0, 0x5affc8],
  /** Admiral Crater: pale moon rock, darker craters, red antenna tips and eyes. */
  baron: [0x1c1814, 0xd4c8a8, 0x8a8070, 0xff5a4a],
  /** Nova: a yellow star, a white-hot core, pink sparkles. */
  selene: [0x3a2206, 0xffe25a, 0xfffbe8, 0xff8ad8],
  /** Krag: grey armour, pale spikes and fangs, a red visor. */
  rook: [0x140e14, 0xa8acb8, 0xe8ecf4, 0xff4a3a],
} as const satisfies Record<CharacterId, Palette>;
