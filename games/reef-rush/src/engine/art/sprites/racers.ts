/**
 * The racers, 16x12 and facing right (the racer view flips them), each drawn
 * around its 12x10 body with two swim-stroke frames, one texture per character.
 *
 * Placeholder: the characters reuse the four phase 4 drawings in CHARACTER_IDS
 * order (a round brass helmet with a porthole, a domed shell, a long mantle
 * trailing tentacles, a squat diving bell with crab claws), so every character
 * has a texture until each gets its own art.
 */
import { CHARACTER_IDS } from '../../../logic/types.ts';
import { Frame, Tex } from '../keys.ts';
import { RacerPalette } from '../palettes.ts';
import type { Palette, PixelRows } from '../pixel.ts';
import { type ArtSheet, sheet } from './sheet.ts';

/** One drawing: its palette and its two swim-stroke frames. */
interface RacerDrawing {
  palette: Palette;
  frames: Readonly<Record<string, PixelRows>>;
}

const HELMET: RacerDrawing = {
  palette: RacerPalette.pip,
  frames: {
    [Frame.a]: [
      '.........00.....',
      '.......003100...',
      '0.....01221110..',
      '30...0121111110.',
      '3300.0321100010.',
      '0222011111023010',
      '.022211111033010',
      '..0022111100010.',
      '...022311111110.',
      '....0001111110..',
      '.......001100...',
      '.........00.....',
    ],
    [Frame.b]: [
      '.........00.....',
      '.......003100...',
      '......01221110..',
      '.....0121111110.',
      '.....0321100010.',
      '....011111023010',
      '..00211111033010',
      '.02222111100010.',
      '022222311111110.',
      '33000001111110..',
      '30.....001100...',
      '0........00.....',
    ],
  },
};

const SHELL: RacerDrawing = {
  palette: RacerPalette.tess,
  frames: {
    [Frame.a]: [
      '................',
      '....000000......',
      '..0011111100....',
      '.01113113111000.',
      '0111313313112220',
      '0113113113112202',
      '0111111111112222',
      '2222222222222220',
      '021111111111000.',
      '.00011111100....',
      '....000200......',
      '.......0........',
    ],
    [Frame.b]: [
      '................',
      '....000000......',
      '.00011111100....',
      '021113113111000.',
      '2111313313112220',
      '0113113113112202',
      '0111111111112222',
      '0222222222222220',
      '.01111111111000.',
      '..0011111120....',
      '....0000220.....',
      '........00......',
    ],
  },
};

const MANTLE: RacerDrawing = {
  palette: RacerPalette.squib,
  frames: {
    [Frame.a]: [
      '...........00...',
      '..........0110..',
      '......000001110.',
      '0000.01111111110',
      '1111013311111110',
      '0222113011111111',
      '1111111111111111',
      '0222222222221110',
      '.000001111111110',
      '......000001110.',
      '..........0110..',
      '...........00...',
    ],
    [Frame.b]: [
      '1..........00...',
      '.1........0110..',
      '..1...000001110.',
      '...1101111111110',
      '...1013311111110',
      '2222113011111111',
      '1111111111111111',
      '2.02222222221110',
      '.2.0001111111110',
      '2.....000001110.',
      '2.........0110..',
      '...........00...',
    ],
  },
};

const BELL: RacerDrawing = {
  palette: RacerPalette.bo,
  frames: {
    [Frame.a]: [
      '......0000......',
      '....00111100....',
      '...0112211110...',
      '..011211111110..',
      '..011211110010..',
      '..01111110330...',
      '..01111110330...',
      '..0111111100100.',
      '.022222222222330',
      '..0030111103030.',
      '...03000030330..',
      '....0....0.00...',
    ],
    [Frame.b]: [
      '......0000......',
      '....00111100....',
      '...0112211110...',
      '..011211111110..',
      '..011211110010..',
      '..01111110330...',
      '..01111110330...',
      '..0111111100100.',
      '.022222222222330',
      '..0003111130030.',
      '...03003300300..',
      '....0..00..0....',
    ],
  },
};

const PLACEHOLDERS = [HELMET, SHELL, MANTLE, BELL] as const;

/** Racer sheets, one per character: frame `a` and `b` are the two strokes of the swim cycle. */
export const RACER_SHEETS: readonly ArtSheet[] = CHARACTER_IDS.map((character, index) => {
  const drawing = PLACEHOLDERS[index % PLACEHOLDERS.length] ?? HELMET;
  return sheet(Tex[character], drawing.palette, drawing.frames);
});
