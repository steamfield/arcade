/**
 * Head-on portraits of the racers in each racer's own palette from
 * `palettes.ts`: 16x16 for the place panel and the podium, and 7x7 heads for
 * the progress strip (pixel art never scales by fractions, so the small size
 * is drawn on its own), one frame per character in each sheet.
 *
 * Placeholder: the characters reuse the four phase 4 faces in CHARACTER_IDS
 * order, matching the racer sprites: a brass helmet with eyes behind the
 * porthole, a round turtle face over a shell, a pointed mantle and tentacles,
 * an iron bell with a crab looking out.
 */
import { CHARACTER_IDS } from '../../../logic/types.ts';
import { RacerPalette } from '../palettes.ts';
import type { Palette, PixelRows } from '../pixel.ts';
import { PortraitFrame, type UiSheet, UiTex } from './keys.ts';

/** One face drawn at both sizes, in one palette. */
interface Face {
  palette: Palette;
  head: PixelRows;
  portrait: PixelRows;
}

const HELMET: Face = {
  palette: RacerPalette.pip,
  head: ['.00000.', '0122110', '0133310', '0132310', '0133310', '0111110', '.00000.'],
  portrait: [
    '....00000000....',
    '..001111111100..',
    '.01122111111110.',
    '.01211111111110.',
    '0121100000011110',
    '0111023333301110',
    '0110333333330110',
    '0110332332330110',
    '0110332332330110',
    '0110333223330110',
    '0111033333301110',
    '0111100000011110',
    '.01111111111110.',
    '.00000000000000.',
    '0122121212121210',
    '0000000000000000',
  ],
};

const SHELL: Face = {
  palette: RacerPalette.tess,
  head: ['.00000.', '0121110', '0101010', '0111110', '0133310', '0111110', '.00000.'],
  portrait: [
    '................',
    '.....000000.....',
    '...0011111100...',
    '..011221111110..',
    '.01122111111110.',
    '.01211111111110.',
    '0111201111201110',
    '0111001111001110',
    '0111111111111110',
    '0111311111131110',
    '0111133333311110',
    '.01111111111110.',
    '..011111111110..',
    '0333000000003330',
    '0323232323232320',
    '0000000000000000',
  ],
};

const MANTLE: Face = {
  palette: RacerPalette.squib,
  head: ['..000..', '.01210.', '0111110', '0311130', '0111110', '0101010', '0.0.0.0'],
  portrait: [
    '.......00.......',
    '......0110......',
    '.....011210.....',
    '....01112210....',
    '...0111112110...',
    '..011111112110..',
    '..011111111110..',
    '.01333111133310.',
    '.01300111100310.',
    '.01111111111110.',
    '..011111111110..',
    '..011011110110..',
    '.0110.0110.0110.',
    '.010..0110..010.',
    '..0....00....0..',
    '................',
  ],
};

const BELL: Face = {
  palette: RacerPalette.bo,
  head: ['.00000.', '0122110', '0100010', '0133310', '0100010', '0111110', '0000000'],
  portrait: [
    '......0000......',
    '....00122100....',
    '...0122111110...',
    '..012111111110..',
    '..011000000110..',
    '..010200002010..',
    '..010300003010..',
    '..010033330010..',
    '..010333333010..',
    '..010303303010..',
    '..011000000110..',
    '..011111111110..',
    '.01111111111110.',
    '0222222222222220',
    '0000000000000000',
    '...3..3..3..3...',
  ],
};

const PLACEHOLDERS = [HELMET, SHELL, MANTLE, BELL] as const;

/** Each character's face, cycling the placeholders. */
const FACES = CHARACTER_IDS.map((character, index) => ({
  character,
  face: PLACEHOLDERS[index % PLACEHOLDERS.length] ?? HELMET,
}));

/** The portrait and head sheets, one frame per character in each, named by `PortraitFrame`. */
export const PORTRAIT_SHEETS: readonly UiSheet[] = [
  {
    key: UiTex.heads,
    frames: FACES.map(({ character, face }) => ({
      name: PortraitFrame[character],
      palette: face.palette,
      rows: face.head,
    })),
  },
  {
    key: UiTex.portraits,
    frames: FACES.map(({ character, face }) => ({
      name: PortraitFrame[character],
      palette: face.palette,
      rows: face.portrait,
    })),
  },
];
