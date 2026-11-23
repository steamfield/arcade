/**
 * The two painted parallax layers behind the course, each tiling horizontally: a far line of low
 * cloud banks with sunset-lit crowns along the horizon, and two near towering cumulus. Two dark
 * colours each, a step off the sky bands, so they recede and racers still read in front of them.
 */
import { Frame } from '../../../art/keys.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { SkyThemeTex, type SkyThemeTexKey } from '../keys.ts';
import { SkyBackdropPalette } from '../palettes.ts';
import { type CloudBankShape, cloudBank } from './cloud-banks.ts';

/** Width of both layers in px; the layer repeats every this many pixels. */
const LAYER_WIDTH = 128;
const FAR_HEIGHT = 64;
const NEAR_HEIGHT = 80;

/** Far banks: many small billows, uneven in size and spacing so the horizon doesn't repeat inside one tile. */
const FAR_BANKS: CloudBankShape = {
  billows: [
    { x: 6, y: 44, radius: 8 },
    { x: 20, y: 40, radius: 10 },
    { x: 34, y: 46, radius: 7 },
    { x: 47, y: 36, radius: 12 },
    { x: 63, y: 44, radius: 8 },
    { x: 77, y: 42, radius: 9 },
    { x: 92, y: 34, radius: 13 },
    { x: 108, y: 44, radius: 8 },
    { x: 120, y: 40, radius: 9 },
  ],
  baseRows: 12,
  litRows: 2,
};

/**
 * Near banks: two towering cumulus, each a heap of small billows rising to a rounded top, on a low
 * flat base, with open sky between them.
 */
const NEAR_BANKS: CloudBankShape = {
  billows: [
    { x: 14, y: 66, radius: 7 },
    { x: 22, y: 58, radius: 9 },
    { x: 32, y: 50, radius: 11 },
    { x: 42, y: 57, radius: 9 },
    { x: 50, y: 65, radius: 7 },
    { x: 78, y: 66, radius: 6 },
    { x: 86, y: 58, radius: 8 },
    { x: 96, y: 49, radius: 10 },
    { x: 106, y: 55, radius: 9 },
    { x: 115, y: 63, radius: 7 },
  ],
  baseRows: 10,
  litRows: 2,
};

/** Backdrop layer sheets. */
export const BACKDROP_SHEETS: readonly ArtSheet<SkyThemeTexKey>[] = [
  sheet(SkyThemeTex.backdropFar, SkyBackdropPalette.far, {
    [Frame.a]: cloudBank(LAYER_WIDTH, FAR_HEIGHT, FAR_BANKS),
  }),
  sheet(SkyThemeTex.backdropNear, SkyBackdropPalette.near, {
    [Frame.a]: cloudBank(LAYER_WIDTH, NEAR_HEIGHT, NEAR_BANKS),
  }),
];
