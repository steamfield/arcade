/**
 * Turns a course's ASCII rows into a Level. The only place level text is read.
 *
 *   #  rock          C  coral (breakable)   ~  kelp            .  open water
 *   =  ledge (one-way platform: holds a body landing on it from above, open from below and the sides)
 *   B  bounce cloud (solid from every side like rock; springs a body landing on it from above
 *      back up, in a medium with `effects.bounceSpeed`; `createWorld` rejects it in any other)
 *   >  <  ^  v       currents pushing in that direction
 *   1  2  3  4       start tiles in RACER_IDS order (player first)
 *   F  finish line (every F sits in one column)
 *   o  pearl         ?  clam                *  urchin          j  jellyfish
 *   @  boost ring (`Level.rings`; reusable, each racer boosted once per ring per race)
 *
 * Storm zones (`LevelDef.lightning`) are column ranges, not glyphs (`lightning-zones.ts`).
 *
 * Start, finish, object and ring tiles are open water. Every row must be the same width. A level's
 * `surface` ranges then turn the water above each surface row to air (`surface.ts`); objects there
 * stay recorded and float in the air, but enemies and starts may not sit in it.
 *
 * Cell names are materials, but what they mean is a behaviour the world's medium interprets:
 * rock is solid, coral is solid until broken, a ledge holds only what lands on it, kelp slows a
 * racer, a current pushes it along its arrow, and water is open. Swimming makes kelp drag and currents flow; another medium may make
 * slow and flow mean something else (thick cloud, a tailwind).
 *
 * A level may add glyphs of its own in `LevelDef.legend`: each extra character behaves as one base
 * cell and names the art a theme draws it with (a shipwreck hull that is rock, a sand bar that is
 * kelp). `Level.glyphs` keeps the character written at every tile, so a theme can tell them apart.
 */

import { parseAsteroids } from '../setpieces/asteroids.ts';
import { parseShiftingWind } from '../setpieces/shifting-wind.ts';
import { parseVents } from '../setpieces/vents.ts';
import { type Cell, type EnemyKind, type Level, type LevelDef, RACER_IDS, type Vec } from '../types.ts';
import { errorAt, LevelError } from './level-error.ts';
import { requireLightningZones } from './lightning-zones.ts';
import { openToAir, requireSurfacesOnMap, requireUnderwater } from './surface.ts';
import { parseWells } from './wells.ts';

export { LevelError } from './level-error.ts';

const TERRAIN: ReadonlyMap<string, Cell> = new Map([
  ['#', 'rock'],
  ['C', 'coral'],
  ['~', 'kelp'],
  ['>', 'current-right'],
  ['<', 'current-left'],
  ['^', 'current-up'],
  ['v', 'current-down'],
  ['.', 'water'],
  ['=', 'ledge'],
  ['B', 'bounce'],
]);

type ObjectList = 'pearls' | 'clams' | 'urchins' | 'jellies' | 'rings';

const OBJECTS: ReadonlyMap<string, ObjectList> = new Map([
  ['o', 'pearls'],
  ['?', 'clams'],
  ['*', 'urchins'],
  ['j', 'jellies'],
  ['@', 'rings'],
]);

/** Enemy glyphs; the tile under one is water. */
const ENEMY_GLYPHS: ReadonlyMap<string, EnemyKind> = new Map([
  ['S', 'shark'],
  ['E', 'eel'],
  ['K', 'crab'],
]);

const START_DIGITS = '1234';
/** The glyph that marks the finish line. */
export const FINISH = 'F';
const VALID_CHARACTERS = [...TERRAIN.keys(), ...START_DIGITS, FINISH, ...OBJECTS.keys(), ...ENEMY_GLYPHS.keys()].join(
  '',
);
const BASE_CELLS: readonly Cell[] = [...TERRAIN.values()];

/** A level's extra glyphs, each to the base cell it behaves as. */
type Legend = ReadonlyMap<string, Cell>;

/** Everything on the map that isn't terrain, collected while the tiles are read. */
interface Markers {
  /** Indexed by start digit minus one; a hole means that digit hasn't been seen. */
  starts: (Vec | undefined)[];
  finishX: number | null;
  pearls: Vec[];
  clams: Vec[];
  urchins: Vec[];
  jellies: Vec[];
  rings: Vec[];
  enemies: { kind: EnemyKind; tile: Vec }[];
}

/**
 * Parses a course definition.
 *
 * @throws {LevelError} For a legend glyph that isn't one UTF-16 character, is whitespace, reuses a built-in character or
 *   names an unknown cell; ragged rows, unknown characters, missing or duplicate start digits,
 *   no finish tile, finish tiles in more than one column, a dark zone outside the map or reversed, a
 *   surface range reversed, off the map or with its row outside 1..height-1, an enemy or start tile
 *   in the air above a surface, a bad gravity well (`parseWells`), or a storm zone reversed, off the map,
 *   overlapping another or with a period too short to warn before it strikes (`requireLightningZones`).
 */
export function parseLevel(def: LevelDef): Level {
  const legend = readLegend(def.legend ?? {});
  const rows = readRows(def.ascii);
  const width = requireEqualWidths(rows);
  const markers: Markers = {
    starts: [],
    finishX: null,
    pearls: [],
    clams: [],
    urchins: [],
    jellies: [],
    rings: [],
    enemies: [],
  };
  const water = rows.map((row, y) => [...row].map((ch, x) => readTile(ch, x, y, markers, legend)));
  const surface = requireSurfacesOnMap(def.surface ?? [], width, rows.length);
  const cells = openToAir(water, surface);
  const starts = requireAllStarts(markers.starts);
  requireUnderwater(cells, markers.enemies, starts);
  const lightning = requireLightningZones(def.lightning ?? [], width);

  return {
    name: def.name,
    width,
    height: rows.length,
    cells,
    glyphs: rows.map((row) => [...row]),
    starts,
    finishX: requireFinish(markers.finishX),
    pearls: markers.pearls,
    clams: markers.clams,
    urchins: markers.urchins,
    jellies: markers.jellies,
    rings: markers.rings,
    enemies: markers.enemies,
    dark: requireDarkZonesOnMap(def.dark ?? [], width),
    surface,
    wells: parseWells(def.wells ?? [], width, rows.length),
    lightning,
    vents: parseVents(def.vents ?? [], width, rows.length),
    shiftingWind: parseShiftingWind(def.shiftingWind ?? [], width, lightning),
    asteroids: parseAsteroids(def.asteroids ?? [], width, rows.length),
  };
}

/** Checks each legend entry and returns the glyph-to-cell map the tile reader uses. */
function readLegend(entries: NonNullable<LevelDef['legend']>): Legend {
  const legend = new Map<string, Cell>();
  for (const [glyph, { cell }] of Object.entries(entries)) {
    // Row widths count UTF-16 units, so an emoji (two units) would make a row wider than its tiles.
    if (glyph.length !== 1) {
      throw new LevelError(`Legend glyph "${glyph}" must be exactly one character (one UTF-16 unit, so no emoji)`);
    }
    // Rows are trimmed before they're read, so a whitespace glyph at a row's edge would vanish.
    if (/\s/.test(glyph)) {
      throw new LevelError(`Legend glyph "${glyph}" is whitespace, which rows lose when trimmed; pick a visible one`);
    }
    if (VALID_CHARACTERS.includes(glyph)) {
      throw new LevelError(`Legend glyph "${glyph}" is a built-in tile (${VALID_CHARACTERS}); pick another character`);
    }
    if (!BASE_CELLS.includes(cell)) {
      throw new LevelError(
        `Legend glyph "${glyph}" maps to unknown cell "${cell}" (expected one of ${BASE_CELLS.join(', ')})`,
      );
    }
    legend.set(glyph, cell);
  }
  return legend;
}

/** Splits level text into trimmed rows, dropping blank lines before the first row and after the last. */
function readRows(ascii: string): string[] {
  const rows = ascii
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.trim());
  const first = rows.findIndex((row) => row !== '');
  const last = rows.findLastIndex((row) => row !== '');
  return first === -1 ? [] : rows.slice(first, last + 1);
}

/** The width every row shares, taken from the first row. */
function requireEqualWidths(rows: string[]): number {
  const width = rows[0]?.length ?? 0;
  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new LevelError(`Row is ${row.length} tiles wide but row 0 is ${width} at row ${y}`, y);
    }
  });
  return width;
}

/** The cell for one character, recording any start, finish or object it marks. */
function readTile(ch: string, x: number, y: number, markers: Markers, legend: Legend): Cell {
  const terrain = TERRAIN.get(ch) ?? legend.get(ch);
  if (terrain) return terrain;

  const objectList = OBJECTS.get(ch);
  const enemy = ENEMY_GLYPHS.get(ch);
  if (objectList) markers[objectList].push({ x, y });
  else if (enemy) markers.enemies.push({ kind: enemy, tile: { x, y } });
  else if (START_DIGITS.includes(ch)) recordStart(markers, Number(ch) - 1, x, y);
  else if (ch === FINISH) recordFinish(markers, x, y);
  else throw errorAt(`Unknown tile "${ch}" (expected one of ${VALID_CHARACTERS}${[...legend.keys()].join('')})`, y, x);
  return 'water';
}

function recordStart(markers: Markers, slot: number, x: number, y: number): void {
  if (markers.starts[slot]) throw errorAt(`Start ${slot + 1} appears a second time`, y, x);
  markers.starts[slot] = { x, y };
}

function recordFinish(markers: Markers, x: number, y: number): void {
  if (markers.finishX !== null && markers.finishX !== x) {
    throw errorAt(`Finish tile outside finish column ${markers.finishX}`, y, x);
  }
  markers.finishX = x;
}

/** Start tiles in RACER_IDS order. */
function requireAllStarts(starts: (Vec | undefined)[]): Vec[] {
  return RACER_IDS.map((id, slot) => {
    const start = starts[slot];
    if (!start) throw new LevelError(`Level has no start tile "${slot + 1}" for ${id}`);
    return start;
  });
}

function requireFinish(finishX: number | null): number {
  if (finishX === null) throw new LevelError(`Level has no finish tile "${FINISH}"`);
  return finishX;
}

/** Copies of the dark zones, each checked to be a forward range of columns on the map. */
function requireDarkZonesOnMap(zones: NonNullable<LevelDef['dark']>, width: number): [number, number][] {
  return zones.map(([from, to], index) => {
    if (from > to) throw new LevelError(`Dark zone ${index} runs backwards from column ${from} to ${to}`);
    if (from < 0 || to >= width) {
      throw new LevelError(`Dark zone ${index} covers columns ${from}-${to} but the map has columns 0-${width - 1}`);
    }
    return [from, to];
  });
}
