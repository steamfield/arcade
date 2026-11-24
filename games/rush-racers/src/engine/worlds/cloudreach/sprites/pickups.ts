/**
 * Cloudreach's pickups: the `?` balloon (full, with a `?` on it and a ribbon bow while it is ready, a
 * popped knot of rubber on a string once it is used, matching Reef's open and closed clam) and the
 * feather. They are the same size as Reef's clam (16x10) and pearl (7x7), and the feather's body is
 * as bright as the pearl so it reads on the deep blue sky bands.
 */
import { Frame } from '../../../art/keys.ts';
import type { Palette } from '../../../art/pixel.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { SkyTex } from '../keys.ts';

/** Balloon: dark outline, red rubber, its shine, and the cream `?`, ribbon and string. */
export const BalloonPalette: Palette = [0x3a0a1a, 0xff4a62, 0xffb0bc, 0xfff4c8];

/** Feather: navy outline, warm white vane (brighter than the pearl), a white shine and a gold quill. */
export const FeatherPalette: Palette = [0x1c2246, 0xfff4e0, 0xffffff, 0xffc040];

/** Pickup sheets: the balloon and the feather. */
export const SKY_PICKUP_SHEETS: readonly ArtSheet<string>[] = [
  sheet(SkyTex.feather, FeatherPalette, {
    // A curved feather leaning right, the quill at its foot.
    [Frame.a]: ['....00.', '...0210', '..02110', '.02110.', '.0110..', '.330...', '3......'],
  }),
  sheet(SkyTex.balloon, BalloonPalette, {
    // Used (`clamClosed`): popped, only the torn knot of rubber left on its string.
    [Frame.clamClosed]: [
      '................',
      '................',
      '................',
      '....0......0....',
      '.....01..10.....',
      '......0110......',
      '.......00.......',
      '.......3........',
      '........3.......',
      '.......3........',
    ],
    // Ready (`clamOpen`, as Reef's open clam is): a full balloon with a `?` on it and a ribbon bow.
    [Frame.clamOpen]: [
      '.....000000.....',
      '....02133310....',
      '...0221113110...',
      '...0211131110...',
      '...0111131110...',
      '....01111110....',
      '.....011310.....',
      '......0000......',
      '.....330033.....',
      '......3..3......',
    ],
  }),
];
