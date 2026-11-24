/**
 * Farside's faces in each slot's own palette (`FarsidePalette` in `palette.ts`): 16x16
 * portraits for the place panel, the select grid and the podium, and 7x7 heads for the progress
 * strip and the standings (pixel art never scales by fractions, so the small size is drawn on its
 * own). Portraits look straight out; light comes from the top left in the shading.
 *
 * The heads ride side by side on the strip, so each has its own outline and still tells apart in
 * grayscale: a glass dome over a visor, two antennae over big eyes, a flame crest, one amber eye
 * in a dark hull, goggles under one antenna, a crown of three antennae, a five-pointed star and a
 * row of spikes over a red visor.
 */
import type { CharacterId } from '../../../../logic/types.ts';
import { CHARACTER_IDS } from '../../../../logic/types.ts';
import type { NamedFrame, PixelRows } from '../../../art/pixel.ts';
import type { ArtSheet } from '../../../art/sprites/sheet.ts';
import { FarCastFrame, FarTex } from '../keys.ts';
import { FarsidePalette } from './palette.ts';

/** One slot's face at both sizes. */
interface Face {
  head: PixelRows;
  portrait: PixelRows;
}

const FACES: Record<CharacterId, Face> = {
  // Bolt: a glass dome with a glowing bulb, yellow lamp eyes, a dent and a mouth grille.
  rudy: {
    head: ['..000..', '.02320.', '0000000', '0131310', '0111110', '0120210', '.00000.'],
    portrait: [
      '....00000000....',
      '...0222222220...',
      '..022223322220..',
      '..022233332220..',
      '..022223322220..',
      '.00000000000000.',
      '.01111111111110.',
      '.01333111133310.',
      '.01303111130310.',
      '.01333111133310.',
      '.01111100111110.',
      '.01102020201110.',
      '.01111111111110.',
      '.00000000000000.',
      '....01111110....',
      '..011111111110..',
    ],
  },
  // Zib: pink-tipped antennae, two big pale eyes, a small mouth and a long thin neck.
  gil: {
    head: ['3.....3', '.1...1.', '.01110.', '0221220', '0201020', '0111110', '.00000.'],
    portrait: [
      '...3........3...',
      '....1......1....',
      '.....1....1.....',
      '....00000000....',
      '...0111111110...',
      '..011111111110..',
      '.01222111122210.',
      '.01200211200210.',
      '.01222111122210.',
      '.01111111111110.',
      '..011100001110..',
      '..011111111110..',
      '...0111111110...',
      '....00111100....',
      '......0110......',
      '.....011110.....',
    ],
  },
  // Flare: a crest of comet flame, orange with a white-hot core, over a round blue face.
  streak: {
    head: ['3.3.3..', '.33233.', '.00000.', '0121210', '0111110', '.01110.', '..000..'],
    portrait: [
      '.3....3.........',
      '..3..323..3.....',
      '..33332223333...',
      '...3322222233...',
      '...0000000000...',
      '..011111111110..',
      '.01111111111110.',
      '.01222111122210.',
      '.01202111120210.',
      '.01111111111110.',
      '.01111111111110.',
      '..011110011110..',
      '..011111111110..',
      '...0111111110...',
      '....00000000....',
      '................',
    ],
  },
  // Umbra: a charcoal hull edged in teal sheen around one big amber eye, two exhaust glints below.
  onyx: {
    head: ['...1...', '.00000.', '0111110', '0223220', '0233320', '0111110', '.00000.'],
    portrait: [
      '................',
      '.......11.......',
      '.......00.......',
      '....00000000....',
      '..001111111100..',
      '.01111111111110.',
      '.01222000022210.',
      '0122203133022210',
      '0122203333022210',
      '.01222000022210.',
      '.01222222222210.',
      '..011111111110..',
      '...0000000000...',
      '....11....11....',
      '................',
      '................',
    ],
  },
  // Widget: one antenna, mint goggle lenses with cream glints, and cream backpack straps.
  nib: {
    head: ['...3...', '.01110.', '0111110', '0330330', '0111110', '.02220.', '.00000.'],
    portrait: [
      '........3.......',
      '........1.......',
      '.....000000.....',
      '....01111110....',
      '...0111111110...',
      '.00000000000000.',
      '.03332000023330.',
      '.03333011033330.',
      '.00000011000000.',
      '..011111111110..',
      '..011110011110..',
      '...0111111110...',
      '....00000000....',
      '...0222222220...',
      '..022122221220..',
      '..000000000000..',
    ],
  },
  // Admiral Crater: three red-tipped antennae as a crown, a cratered rock face, a heavy brow over
  // red eyes and a wide mouth.
  baron: {
    head: ['3..3..3', '1..1..1', '0000000', '0121110', '0301030', '0111210', '0000000'],
    portrait: [
      '..3....3....3...',
      '..1....1....1...',
      '..1....1....1...',
      '.00000000000000.',
      '0111211111121110',
      '0112221111111110',
      '0111211111122110',
      '0122221111222210',
      '0110301111030110',
      '0111111111111110',
      '0112111111111210',
      '0110000000000110',
      '0111111111111110',
      '0111112211111110',
      '.01111111111110.',
      '..000000000000..',
    ],
  },
  // Nova: a yellow star with a white-hot middle, two dark eyes and pink sparkles beside it.
  selene: {
    head: ['...0...', '.00100.', '0111110', '.01210.', '.01110.', '0110110', '00...00'],
    portrait: [
      '.......00.......',
      '..3...0110......',
      '......0110...3..',
      '.....012210.....',
      '0000001221000000',
      '0111112222111110',
      '.01111222211110.',
      '..011012210110..',
      '...0112222110...',
      '...0111001110...',
      '...0111111110...',
      '..011110011110..',
      '..01110..01110..',
      '.01100....00110.',
      '.000...3....000.',
      '................',
    ],
  },
  // Krag: a spiked grey helmet, a red visor slit, pale fangs and spiked shoulders.
  rook: {
    head: ['.2.2.2.', '0000000', '0111110', '0333330', '0111110', '0202020', '.00000.'],
    portrait: [
      '...2...22...2...',
      '..020.0220.020..',
      '.00000000000000.',
      '.01111111111110.',
      '0111111111111110',
      '0110000000000110',
      '0103333003333010',
      '0110000000000110',
      '0111111111111110',
      '0121111111111210',
      '0111100000011110',
      '.01112020201110.',
      '..011111111110..',
      '...0000000000...',
      '.2.0111111110.2.',
      '.21111111111112.',
    ],
  },
};

/** One sheet frame per slot, named by `FarCastFrame`, drawn in that slot's palette. */
function framesOf(size: keyof Face): NamedFrame[] {
  return CHARACTER_IDS.map((character) => ({
    name: FarCastFrame[character],
    palette: FarsidePalette[character],
    rows: FACES[character][size],
  }));
}

/** The portrait and head sheets, one frame per slot in each, named by `FarCastFrame`. */
export const FARSIDE_FACE_SHEETS: readonly ArtSheet<string>[] = [
  { key: FarTex.heads, frames: framesOf('head') },
  { key: FarTex.portraits, frames: framesOf('portrait') },
];
