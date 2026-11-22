/**
 * The UI icon set: 9x9 icons for the HUD and menus (kick, burst, the five
 * power-ups, the finish flag, place arrows and the menu cursor fin) and 12x14
 * medals for the results podium. Each icon is a bold silhouette with an ink
 * outline so it reads on any panel, and each medal carries its numeral, so
 * first, second and third differ by more than colour.
 */

import { ItemPalette } from '../palettes.ts';
import type { Palette, PixelRows } from '../pixel.ts';
import type { UiSheet } from './keys.ts';
import { IconFrame, MedalFrame, UiTex } from './keys.ts';
import { UiColour, UiRamp } from './palette.ts';

/** Icon palettes: outline first, then the icon's own colours. */
const IconPalette = {
  kick: [UiColour.ink, 0x4cc8f0, 0xd8f6ff],
  burst: [UiColour.ink, UiColour.sun, 0xfff3c4, UiRamp.sunDark],
  flag: [UiColour.ink, UiColour.foam, 0x2a2a3a, 0x8a8aa0],
  up: [UiColour.ink, UiColour.sun, 0xfff3c4],
  down: [UiColour.ink, UiColour.coral, 0xffc0b8],
  cursor: [UiColour.ink, UiColour.sun, 0xfff3c4, UiRamp.sunDark],
} as const satisfies Record<string, Palette>;

/** Medal palettes: outline, metal, metal light, ribbon. */
const MedalPalette = {
  first: [UiColour.ink, 0xf2b01e, 0xfff0a0, 0x3060d8],
  second: [UiColour.ink, 0xa8b4c8, 0xf0f4fa, 0xd84060],
  third: [UiColour.ink, 0xc07038, 0xf4c098, 0x30a860],
} as const satisfies Record<string, Palette>;

const icon = (name: string, palette: Palette, rows: PixelRows) => ({ name, palette, rows });

/** The 9x9 icon sheet and the 12x14 medal sheet. */
export const ICON_SHEETS: readonly UiSheet[] = [
  {
    key: UiTex.icons,
    frames: [
      // Two chevrons: a kick is a short dash forward.
      icon(IconFrame.kick, IconPalette.kick, [
        '.........',
        '00..00...',
        '010.010..',
        '.010.010.',
        '..012.012',
        '.010.010.',
        '010.010..',
        '00..00...',
        '.........',
      ]),
      // A starburst: burst spends every stacked power-up at once.
      icon(IconFrame.burst, IconPalette.burst, [
        '....0....',
        '.1.010.1.',
        '..01210..',
        '.0122210.',
        '012222210',
        '.0122210.',
        '..01310..',
        '.1.010.1.',
        '....0....',
      ]),
      // Jet Fins: a swept fin cutting the water line.
      icon(IconFrame.jetFin, ItemPalette.jetFin, [
        '..00.....',
        '..010....',
        '..0210...',
        '.02210...',
        '.022110..',
        '0221110..',
        '01111110.',
        '333333333',
        '.........',
      ]),
      // Bubble Shield: a ring of bubble with a shine.
      icon(IconFrame.bubbleShield, ItemPalette.bubbleShield, [
        '..00000..',
        '.0111110.',
        '013322210',
        '013222210',
        '012222210',
        '012222210',
        '011222110',
        '.0111110.',
        '..00000..',
      ]),
      // Puffer: a spiny round fish facing right.
      icon(IconFrame.puffer, ItemPalette.puffer, [
        '..3.3.3..',
        '3.00000.3',
        '.0122220.',
        '301220203',
        '.0122220.',
        '301111103',
        '.0111110.',
        '3.00000.3',
        '..3.3.3..',
      ]),
      // Ink Sac: a dark drop with a sheen.
      icon(IconFrame.inkSac, ItemPalette.inkSac, [
        '....0....',
        '...010...',
        '...010...',
        '..01210..',
        '.0123210.',
        '.0122110.',
        '.0111110.',
        '..01110..',
        '...000...',
      ]),
      // Glow Lantern: a framed lamp with a hot core.
      icon(IconFrame.glowLantern, ItemPalette.glowLantern, [
        '...000...',
        '..0...0..',
        '.0111110.',
        '.0122210.',
        '.0123210.',
        '.0122210.',
        '.0111110.',
        '..01110..',
        '...000...',
      ]),
      // Finish flag: a chequered pennant on a pole.
      icon(IconFrame.finishFlag, IconPalette.flag, [
        '00000000.',
        '01212120.',
        '02121210.',
        '01212120.',
        '02121210.',
        '0300000..',
        '030......',
        '030......',
        '000......',
      ]),
      // Place gained: a gold arrow up.
      icon(IconFrame.arrowUp, IconPalette.up, [
        '....0....',
        '...020...',
        '..01210..',
        '.0111110.',
        '000111000',
        '..01110..',
        '..01110..',
        '..01110..',
        '..00000..',
      ]),
      // Place lost: a coral arrow down.
      icon(IconFrame.arrowDown, IconPalette.down, [
        '..00000..',
        '..01110..',
        '..01110..',
        '..01110..',
        '000111000',
        '.0111110.',
        '..01110..',
        '...010...',
        '....0....',
      ]),
      // Menu cursor: a small gold fin pointing at the selection.
      icon(IconFrame.cursorFin, IconPalette.cursor, [
        '00.......',
        '0200.....',
        '012200...',
        '01112200.',
        '011111120',
        '01113300.',
        '013300...',
        '0300.....',
        '00.......',
      ]),
    ],
  },
  {
    key: UiTex.medals,
    frames: [
      icon(MedalFrame.first, MedalPalette.first, medal(['.00.', '000.', '.00.', '.00.', '0000'])),
      icon(MedalFrame.second, MedalPalette.second, medal(['000.', '..00', '.00.', '00..', '0000'])),
      icon(MedalFrame.third, MedalPalette.third, medal(['000.', '..00', '.00.', '..00', '000.'])),
    ],
  },
];

/** A 12x14 medal: a ribbon V over a round face with `numeral` (4x5, `0` pixels) struck into it. */
function medal(numeral: PixelRows): PixelRows {
  const face = [
    '..00000000..',
    '.0122222110.',
    '012111111110',
    '012111111110',
    '011111111110',
    '011111111110',
    '011111111110',
    '011111111110',
    '.0111111110.',
    '..00000000..',
  ];
  const struck = face.map((row, y) => {
    const digit = numeral[y - 3];
    if (!digit) return row;
    return row.slice(0, 4) + [...digit].map((pixel, x) => (pixel === '0' ? '0' : row[4 + x])).join('') + row.slice(8);
  });
  return ['.033....330.', '..033..330..', '...033330...', '....0330....', ...struck];
}
