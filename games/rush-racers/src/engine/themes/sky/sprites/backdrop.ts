/**
 * The two painted parallax layers behind the course, each tiling horizontally: a far line of low
 * cloud banks with sunset-lit crowns along the horizon and the setting sun half hidden behind them,
 * and two near towering cumulus. Dark colours a step off the sky bands, so they recede and racers
 * still read in front of them. The far layer is wide enough that only one sun is ever on screen.
 */
import { Frame } from '../../../art/keys.ts';
import { type ArtSheet, sheet } from '../../../art/sprites/sheet.ts';
import { SkyThemeTex, type SkyThemeTexKey } from '../keys.ts';
import { SkyBackdropPalette } from '../palettes.ts';
import { type Billow, type CloudBankShape, cloudBank } from './cloud-banks.ts';

/** Width in px of one run of far billows, which the far layer repeats. */
const FAR_RUN_WIDTH = 128;
/** Far billow runs in the far layer: wider than any screen plus the far layer's parallax travel. */
const FAR_RUNS = 5;
const FAR_WIDTH = FAR_RUN_WIDTH * FAR_RUNS;
const FAR_HEIGHT = 64;
const NEAR_WIDTH = 128;
const NEAR_HEIGHT = 80;

/** One run of far billows, uneven in size and spacing so the horizon doesn't repeat inside a run. */
const FAR_RUN: readonly Billow[] = [
  { x: 6, y: 44, radius: 8 },
  { x: 20, y: 40, radius: 10 },
  { x: 34, y: 46, radius: 7 },
  { x: 47, y: 36, radius: 12 },
  { x: 63, y: 44, radius: 8 },
  { x: 77, y: 42, radius: 9 },
  { x: 92, y: 34, radius: 13 },
  { x: 108, y: 44, radius: 8 },
  { x: 120, y: 40, radius: 9 },
];

/** The setting sun, placed so it is on screen from the start and slides left as the course scrolls. */
const SUN: Billow = { x: 248, y: 44, radius: 13 };

/** Far banks: the run repeated across the layer, less the one billow that would sit on the sun's face. */
const FAR_BANKS: CloudBankShape = {
  billows: Array.from({ length: FAR_RUNS }, (_, run) =>
    FAR_RUN.map((billow) => ({ ...billow, x: billow.x + run * FAR_RUN_WIDTH })),
  )
    .flat()
    .filter((billow) => billow.x !== SUN.x),
  baseRows: 12,
  litRows: 2,
  sun: SUN,
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
    [Frame.a]: cloudBank(FAR_WIDTH, FAR_HEIGHT, FAR_BANKS),
  }),
  sheet(SkyThemeTex.backdropNear, SkyBackdropPalette.near, {
    [Frame.a]: cloudBank(NEAR_WIDTH, NEAR_HEIGHT, NEAR_BANKS),
  }),
];
