/**
 * Cloudreach's cast colours: four per slot, shared by the racers in `racers.ts` and the portraits
 * and heads in `portraits.ts`, so a flyer looks the same in the sky, on the strip and on the select
 * screen.
 */
import type { CharacterId } from '../../../../logic/types.ts';
import type { Palette } from '../../../art/pixel.ts';

/**
 * Each slot's palette: outline, main, second, accent. The main colour holds 3:1 against every
 * theme's contrast bands so the flyer reads in any light (`sprites.test.ts`). The sky is a deep
 * blue, so the dark-plumaged flyers take a bright part of their look as the main colour and carry
 * the dark plumage as the second: the puffin's black back and the bat's dusk membranes. The pelican's
 * second, its golden bill and pouch, is darker than its cream main too, since the pouch is a colour
 * of its own rather than a pale belly. Every other second is the paler tone: a belly, throat or body.
 */
export const CloudreachPalette = {
  /** Puffin: a white face and belly, a black back and wings, an orange beak and feet, orange-glinting goggles. */
  rudy: [0x0a0a14, 0xf8f6f0, 0x2c2a3c, 0xff7a2c],
  /** Hummingbird: emerald feathers, a pale belly and needle beak, a ruby throat. */
  gil: [0x0a2a14, 0x78e070, 0xeaffe4, 0xff3c78],
  /** Swift: sky-steel feathers, a white throat, a yellow beak. */
  streak: [0x0e1a3a, 0x8cd4ff, 0xf4fbff, 0xffe040],
  /** Bat: lilac fur and wing bones over dusk-purple membranes, red eyes. */
  onyx: [0x0a0612, 0xc8a8ff, 0x3a2e52, 0xff4060],
  /** Flying squirrel: warm grey fur and gliding membrane, a cream belly, a rust-brown satchel and strap. */
  nib: [0x2a1a10, 0xd0bca8, 0xfff4e4, 0xc8743a],
  /** Pelican: cream feathers, a golden bill and pouch, a navy admiral's hat. */
  baron: [0x1a1c2c, 0xf4e8d0, 0xffb83c, 0x34449a],
  /** Luna moth: pale green wings, a white furry body, magenta wing edges and eyespots. */
  selene: [0x1a3a24, 0xb8f0a0, 0xf8fff0, 0xc0306a],
  /** Hawk: tawny feathers, a cream breast, a yellow hooked beak and talons. */
  rook: [0x24140a, 0xe8a050, 0xfff0d8, 0xffd23a],
} as const satisfies Record<CharacterId, Palette>;
