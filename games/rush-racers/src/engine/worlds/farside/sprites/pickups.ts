/**
 * Farside's pickups: the supply pod (an orange capsule with a `?` on it while it is ready, split
 * open and empty once a racer has taken its prize, matching Reef's open and closed clam) and the
 * stardust. They are the same size as Reef's clam (16x10) and pearl (7x7), and the stardust's body
 * is at least as bright as the pearl so it reads on the dark space bands.
 */
import { Frame } from '../../../art/keys.ts';
import type { Palette } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { FarTex } from '../keys.ts';

/** Pod: dark rust outline and empty inside, orange shell, pale orange shine and the cream `?`. */
export const PodPalette: Palette = [0x2a1004, 0xff8a30, 0xffc880, 0xfff4d0];

/** Stardust: dark gold outline, pale gold body (as bright as the pearl), white shine, a warm gold core. */
export const StardustPalette: Palette = [0x5a3a10, 0xfff2c4, 0xffffff, 0xffd060];

/** Pickup sheets: the pod and the stardust. */
export const FAR_PICKUP_SHEETS: readonly ArtSheet<string>[] = [
  sheet(FarTex.stardust, StardustPalette, {
    // A four-point star with a warm core.
    [Frame.a]: ['...1...', '...1...', '..121..', '1123211', '..121..', '...1...', '...1...'],
  }),
  sheet(FarTex.pod, PodPalette, {
    // Used (`clamClosed`): the capsule split in two, its top half lifted off an empty bottom half.
    [Frame.clamClosed]: [
      '...0000000000...',
      '..022222222220..',
      '.00000000000000.',
      '................',
      '0000000000000000',
      '0100000000000010',
      '.01000000000010.',
      '.01111111111110.',
      '..011111111110..',
      '...0000000000...',
    ],
    // Ready (`clamOpen`, as Reef's open clam is): a whole capsule with a `?` on its face.
    [Frame.clamOpen]: [
      '...0000000000...',
      '..022222222220..',
      '.02111133311110.',
      '0211113111311110',
      '0211111111311110',
      '0111111113111110',
      '0111111131111110',
      '.01111111111110.',
      '..011111311110..',
      '...0000000000...',
    ],
  }),
];
