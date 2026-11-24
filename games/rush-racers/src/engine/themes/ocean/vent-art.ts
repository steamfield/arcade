/**
 * The ocean's geyser vent art, which `view/vent-view.ts` draws for Sunlit Shallows' vents: a
 * fissure in the floor, the same fissure lit for the warning, and rising bubble streaks tiled up the
 * eruption column. Every frame is 16x16, one tile; the fissure sits in the bottom rows so it lies on
 * the floor under the vent's tile.
 */
import type { NamedFrame, PixelRows } from '../../art/pixel.ts';
import type { VentArt } from '../../view/set-pieces/vent-view.ts';
import { TerrainPalette, WaterLight } from './palettes.ts';

/** Empty rows above the fissure, so it sits at the bottom of the tile. */
const ABOVE_FISSURE: PixelRows = Array.from({ length: 12 }, () => '.'.repeat(16));

/** The fissure: its open crack (0) in the stone lip round it (1). Its ends meet when two tiles sit side by side. */
const FISSURE: PixelRows = [
  ...ABOVE_FISSURE,
  '.......0........',
  '...0..010...0...',
  '.00100111001100.',
  '0111111111111110',
];

/** Bubble streaks, faint (0) and bright (1), spaced so the tile repeats up the column without a seam. */
const BUBBLES: PixelRows = [
  '..1.......0.....',
  '..0.....1.0...1.',
  '........0.....0.',
  '.1..0.........0.',
  '.0..0....1......',
  '....1....0...1..',
  '.........0...0..',
  '..1...0.........',
  '..0...0....1....',
  '......1....0....',
  '.0.........0..1.',
  '.0....1.......0.',
  '.1....0...0.....',
  '..........0..1..',
  '....0.....1..0..',
  '....0..1........',
];

const CRACK: NamedFrame = { name: 'crack', palette: [TerrainPalette.rock[0], TerrainPalette.rock[1]], rows: FISSURE };
/** The fissure again with the crack white and its lip in the current's bright blue, laid over the crack as it warns. */
const GLOW: NamedFrame = { name: 'glow', palette: [WaterLight.caustic, TerrainPalette.current[1]], rows: FISSURE };
const BUBBLE_STREAKS: NamedFrame = { name: 'bubbles', palette: TerrainPalette.current, rows: BUBBLES };

/** The ocean's vent art, drawn into one texture the first time a race shows vents. */
export const OCEAN_VENT_ART: VentArt = { texture: 'ocean-vent', crack: CRACK, glow: GLOW, bubbles: BUBBLE_STREAKS };
