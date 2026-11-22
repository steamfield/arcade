/**
 * World-side HUD sprites: the progress-strip markers (one shape per racer, in
 * that racer's colour) and the kick-ready pip, which changes shape as well as
 * colour when it cools down.
 */
import { Frame, Tex } from '../keys.ts';
import { HudPalette } from '../palettes.ts';
import { type ArtSheet, sheet } from './sheet.ts';

/** HUD sheets. Marker frames each use their own racer palette. */
export const HUD_SHEETS: readonly ArtSheet[] = [
  {
    key: Tex.hudMarker,
    frames: [
      {
        name: Frame.markerCircle,
        palette: HudPalette.markerPip,
        rows: ['..000..', '.01110.', '0121110', '0111110', '0111110', '.01110.', '..000..'],
      },
      {
        name: Frame.markerSquare,
        palette: HudPalette.markerTess,
        rows: ['0000000', '0111110', '0122110', '0121110', '0111110', '0111110', '0000000'],
      },
      {
        name: Frame.markerTriangle,
        palette: HudPalette.markerSquib,
        rows: ['...0...', '..010..', '..010..', '.01210.', '.01110.', '0111110', '0000000'],
      },
      {
        name: Frame.markerDiamond,
        palette: HudPalette.markerBo,
        rows: ['...0...', '..010..', '.01210.', '0111110', '.01110.', '..010..', '...0...'],
      },
    ],
  },
  sheet(Tex.kickPip, HudPalette.kickPip, {
    [Frame.pipReady]: ['.1111.', '111111', '112211', '112211', '111111', '.1111.'],
    [Frame.pipCooling]: ['.0000.', '00..00', '0....0', '0....0', '00..00', '.0000.'],
  }),
];
