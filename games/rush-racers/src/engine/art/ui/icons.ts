/**
 * The UI icon set: 9x9 icons for the HUD and menus (dash, fire, a world's ten power-ups, the
 * finish flag, place arrows, the lock-on arrow and the menu cursor fin) and 12x14 medals for the
 * results podium. Each is a bold silhouette with a 1 px foam rim (index 0), sticker style: an ink
 * outline would vanish into the indigo panels and the inset wells the icons sit on. Each medal
 * carries its numeral, so first, second and third differ by more than colour.
 *
 * The ten power-up frames come from the caller (Reef's, at boot), so the kit names no world.
 */

import type { NamedFrame, Palette, PixelRows } from '../pixel.ts';
import { IconFrame, MedalFrame, type UiSheet, UiTex } from './keys.ts';
import { UiColour, UiRamp } from './palette.ts';

/** The light rim every icon and medal is outlined in. */
export const ICON_RIM = UiColour.foam;

/** A world item palette with its dark outline swapped for the UI rim. */
export const withRim = (palette: Palette): Palette => [ICON_RIM, ...palette.slice(1)];

/** Icon palettes: rim first, then the icon's own colours. */
const IconPalette = {
  dash: [ICON_RIM, 0x4cc8f0, 0xd8f6ff],
  fire: [ICON_RIM, UiColour.sun, 0xfff3c4, UiRamp.sunDark],
  flag: [ICON_RIM, 0xd8d4e8, 0x2a2a3a, 0x8a8aa0],
  up: [ICON_RIM, UiColour.sun, 0xfff3c4],
  down: [ICON_RIM, UiColour.coral, 0xffc0b8],
  cursor: [ICON_RIM, UiColour.sun, 0xfff3c4, UiRamp.sunDark],
  warn: [ICON_RIM, UiColour.coral, 0xffc0b8],
} as const satisfies Record<string, Palette>;

/** Medal palettes: rim (also the face's shine), metal, the struck numeral, ribbon. */
const MedalPalette = {
  first: [ICON_RIM, 0xf2b01e, UiColour.ink, 0x4a80f0],
  second: [ICON_RIM, 0xa8b4c8, UiColour.ink, 0xe04a6a],
  third: [ICON_RIM, 0xc07038, UiColour.ink, 0x30a860],
} as const satisfies Record<string, Palette>;

const icon = (name: string, palette: Palette, rows: PixelRows) => ({ name, palette, rows });

/**
 * The 9x9 icon sheet and the 12x14 medal sheet. `itemIcons` are the ten power-up frames, named by
 * `IconFrame` and drawn between the fire icon and the lock-on arrow.
 */
export function iconSheets(itemIcons: readonly NamedFrame[]): readonly UiSheet[] {
  return [
    {
      key: UiTex.icons,
      frames: [
        // Two chevrons: a dash is a short burst of speed forward.
        icon(IconFrame.dash, IconPalette.dash, [
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
        // A starburst: fire uses the selected item.
        icon(IconFrame.fire, IconPalette.fire, [
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
        ...itemIcons,
        // Lock-on warning: a wedge pointing right at the squid; the HUD turns it to face it.
        icon(IconFrame.warnArrow, IconPalette.warn, [
          '.0.......',
          '.010.....',
          '.01110...',
          '.0111110.',
          '.01111110',
          '.0111110.',
          '.01110...',
          '.010.....',
          '.0.......',
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
}

/** A 12x14 medal: a ribbon V over a round face with `numeral` (4x5, `0` pixels) struck into it in ink. */
function medal(numeral: PixelRows): PixelRows {
  const face = [
    '..00000000..',
    '.0100000110.',
    '010111111110',
    '010111111110',
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
    return row.slice(0, 4) + [...digit].map((pixel, x) => (pixel === '0' ? '2' : row[4 + x])).join('') + row.slice(8);
  });
  return ['.033....330.', '..033..330..', '...033330...', '....0330....', ...struck];
}
