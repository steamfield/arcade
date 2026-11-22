/**
 * 16x16 head-on portraits of the four racers for the place panel, the podium
 * and the progress strip, in each racer's own palette from `palettes.ts`.
 * They echo the in-race silhouettes: Pip's brass helmet with eyes behind the
 * porthole, Tess's round turtle face over her shell, Squib's pointed mantle
 * and tentacles, Bo's iron bell with the crab looking out.
 */
import { RacerPalette } from '../palettes.ts';
import type { UiSheet } from './keys.ts';
import { PortraitFrame, UiTex } from './keys.ts';

/** The portrait sheet, one frame per racer id. */
export const PORTRAIT_SHEETS: readonly UiSheet[] = [
  {
    key: UiTex.portraits,
    frames: [
      {
        name: PortraitFrame.player,
        palette: RacerPalette.pip,
        rows: [
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
      },
      {
        name: PortraitFrame.tess,
        palette: RacerPalette.tess,
        rows: [
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
      },
      {
        name: PortraitFrame.squib,
        palette: RacerPalette.squib,
        rows: [
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
      },
      {
        name: PortraitFrame.bo,
        palette: RacerPalette.bo,
        rows: [
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
      },
    ],
  },
];
