/**
 * Farside's pickups: the `?` pod (a `?` block while it is ready, an emptied box with its lid up
 * while it is shut, matching Reef's open and closed clam)
 * and the stardust. They are the same size as Reef's clam (16x10) and pearl (7x7), and the stardust's body
 * is as bright as the pearl so it reads on the dark space bands.
 */
import { Frame } from '../../../art/keys.ts';
import type { Palette } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { FarTex } from '../keys.ts';

/** Pod: dark outline, wood, lit wood edge and the pale `?`. */
export const PodPalette: Palette = [0x2a1408, 0xb8803c, 0xf0c070, 0xfff4b0];

/** Stardust: dark outline, pale gold nut (as bright as the pearl), its shine and a brown cap. */
export const StardustPalette: Palette = [0x3a2008, 0xfff0b0, 0xffffff, 0x9a5a20];

/** Pickup sheets: the pod and the stardust. */
export const FAR_PICKUP_SHEETS: readonly ArtSheet<string>[] = [
  sheet(FarTex.stardust, StardustPalette, {
    [Frame.a]: ['..000..', '.03330.', '0333330', '0121110', '0111110', '.01110.', '..000..'],
  }),
  sheet(FarTex.pod, PodPalette, {
    // Shut (`clamClosed`) after a racer took its prize: the lid knocked up over an empty box.
    [Frame.clamClosed]: [
      '..000000000000..',
      '.02222222222220.',
      '.01111111111110.',
      '0000000000000000',
      '.00000000000000.',
      '.01110000001110.',
      '.01110000001110.',
      '.01111000011110.',
      '.01111111111110.',
      '..000000000000..',
    ],
    // Ready (`clamOpen`, as Reef's open clam is): a block with a bold `?` on its face.
    [Frame.clamOpen]: [
      '0000000000000000',
      '0222222222222220',
      '0211113333111110',
      '0211133113311110',
      '0211111133111110',
      '0211111331111110',
      '0211111111111110',
      '0211111331111110',
      '0111111111111110',
      '0000000000000000',
    ],
  }),
];
