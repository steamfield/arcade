/**
 * Thornwood's cast colours: four per slot, shared by the racers in `racers.ts` and the portraits and
 * heads in `portraits.ts`, so a critter looks the same on the course, on the strip and on the
 * select screen.
 */
import type { CharacterId } from '../../../../logic/types.ts';
import type { Palette } from '../../../art/pixel.ts';

/**
 * Each slot's palette: outline, main, second, accent. The main colour holds 3:1 against every
 * theme's contrast bands so the critter reads in any light (`sprites.test.ts`). The second is the
 * other body tone: a pale face, belly or glint for most, but Shade's charcoal coat, the one second
 * colour darker than its main.
 */
export const ThornwoodPalette = {
  /** Badger: grey coat, pale face stripe and lamp glass, an orange miner's helmet. */
  rudy: [0x1a1420, 0xb8bcc8, 0xfff4c8, 0xff9a28],
  /** Hare: sandy coat, cream belly and tail, pink inner ears. */
  gil: [0x2c1a0c, 0xe0b880, 0xfff2dc, 0xff8a9c],
  /** Fox: bright orange coat, cream chest and tail tip, dark socks and ear tips. */
  streak: [0x2e0e06, 0xff7a30, 0xfff0d4, 0x5a2410],
  /** Panther cub: a charcoal coat with a lilac sheen on its lit edges and belly, green-gold eyes. */
  onyx: [0x07060e, 0xb4a4ec, 0x3c3858, 0xd8ff3c],
  /** Chipmunk: tawny coat, cream stripes and belly, cyan goggle lenses. */
  nib: [0x34180a, 0xf0b468, 0xfff0d8, 0x5ae2ff],
  /** Tortoise: moss-green shell, tan skin, a gold crown. */
  baron: [0x10260c, 0x92d058, 0xe8d49a, 0xffd23c],
  /** Owl: tawny feathers, a cream face and belly, a rose scarf. */
  selene: [0x28160c, 0xd8aa66, 0xfff0d2, 0xe8446e],
  /** Wolf: grey fur, pale muzzle and belly, yellow hunter's eyes. */
  rook: [0x10141e, 0x9aa8bc, 0xeaf0f8, 0xffd23a],
} as const satisfies Record<CharacterId, Palette>;
