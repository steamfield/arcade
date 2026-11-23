/**
 * Thornwood's pickups: the `?` crate (shut with a `?` on its face, then popped open on its prize)
 * and the acorn. They are the same size as Reef's clam (16x10) and pearl (7x7), and the acorn's body
 * is as bright as the pearl so it reads on the dark forest bands.
 */
import { Frame } from '../../../art/keys.ts';
import type { Palette } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { ThornTex } from '../keys.ts';

/** Crate: dark outline, wood, lit wood edge, the pale `?` and the gold prize. */
export const CratePalette: Palette = [0x2a1408, 0xb8803c, 0xf0c070, 0xfff4b0];

/** Acorn: dark outline, pale gold nut (as bright as the pearl), its shine and a brown cap. */
export const AcornPalette: Palette = [0x3a2008, 0xfff0b0, 0xffffff, 0x9a5a20];

/** Pickup sheets: the crate and the acorn. */
export const THORN_PICKUP_SHEETS: readonly ArtSheet<string>[] = [
  sheet(ThornTex.acorn, AcornPalette, {
    [Frame.a]: ['..000..', '.03330.', '0333330', '0121110', '0111110', '.01110.', '..000..'],
  }),
  sheet(ThornTex.crate, CratePalette, {
    // A shut block, a bold `?` on its face.
    [Frame.clamClosed]: [
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
    // The lid knocked up, a gold prize shining out of the dark box.
    [Frame.clamOpen]: [
      '..000000000000..',
      '.02222222222220.',
      '.01111111111110.',
      '0000000000000000',
      '.00000033000000.',
      '.01110333301110.',
      '.01110033001110.',
      '.01111000011110.',
      '.01111111111110.',
      '..000000000000..',
    ],
  }),
];
