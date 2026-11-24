/**
 * Reef's pickups, the things a racer swims into for a reward: the pearl (7x7) and the clam
 * (16x10, closed, then open showing the prize). Both are bright and warm against the blue water.
 */
import { Frame } from '../../../art/keys.ts';
import type { Palette } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { ReefTex } from '../keys.ts';

/** Pearl: outline, body, shine. */
export const PearlPalette: Palette = [0x4a4660, 0xe8e4f4, 0xffffff];

/** Clam: outline, shell, shell light, the gold prize inside. */
const ClamPalette: Palette = [0x24163e, 0x8a6cd0, 0xd6c6ff, 0xffd23f];

/** Pickup sheets: the pearl and the clam. */
export const REEF_PICKUP_SHEETS: readonly ArtSheet<string>[] = [
  sheet(ReefTex.pearl, PearlPalette, {
    [Frame.a]: ['..000..', '.01110.', '0121110', '0111110', '0111110', '.01110.', '..000..'],
  }),
  sheet(ReefTex.clam, ClamPalette, {
    [Frame.clamClosed]: [
      '................',
      '................',
      '.....000000.....',
      '...0012121200...',
      '..012121212120..',
      '.01212121212120.',
      '.00000000000000.',
      '..011111111110..',
      '...0012121200...',
      '.....000000.....',
    ],
    [Frame.clamOpen]: [
      '....00000000....',
      '..001212121200..',
      '.01212121212120.',
      '.00000000000000.',
      '......0330......',
      '.....033230.....',
      '.00000333300000.',
      '.01111000011110.',
      '..001212121200..',
      '....00000000....',
    ],
  }),
];
