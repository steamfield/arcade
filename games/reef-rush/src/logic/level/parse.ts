/**
 * Turns a course's ASCII rows into a Level. The only place level text is read.
 *
 *   #  rock          C  coral (breakable)   ~  kelp            .  open water
 *   >  <  ^  v       currents pushing in that direction
 *   1  2  3  4       start tiles in RACER_IDS order (player first)
 *   F  finish line (every F sits in one column)
 *   o  pearl         ?  clam                *  urchin          j  jellyfish
 *
 * Start, finish and object tiles are open water. Every row must be the same width.
 */
import { type Cell, type Level, type LevelDef, RACER_IDS, type Vec } from '../types.ts';

/** A course that can't be parsed or raced. `row` and `col` are 0-based and null when the whole level is at fault. */
export class LevelError extends Error {
  readonly row: number | null;
  readonly col: number | null;

  constructor(message: string, row: number | null = null, col: number | null = null) {
    super(message);
    this.name = 'LevelError';
    this.row = row;
    this.col = col;
  }
}

const TERRAIN: ReadonlyMap<string, Cell> = new Map([
  ['#', 'rock'],
  ['C', 'coral'],
  ['~', 'kelp'],
  ['>', 'current-right'],
  ['<', 'current-left'],
  ['^', 'current-up'],
  ['v', 'current-down'],
  ['.', 'water'],
]);

type ObjectList = 'pearls' | 'clams' | 'urchins' | 'jellies';

const OBJECTS: ReadonlyMap<string, ObjectList> = new Map([
  ['o', 'pearls'],
  ['?', 'clams'],
  ['*', 'urchins'],
  ['j', 'jellies'],
]);

const START_DIGITS = '1234';
const FINISH = 'F';
const VALID_CHARACTERS = [...TERRAIN.keys(), ...START_DIGITS, FINISH, ...OBJECTS.keys()].join('');

/** Everything on the map that isn't terrain, collected while the tiles are read. */
interface Markers {
  /** Indexed by start digit minus one; a hole means that digit hasn't been seen. */
  starts: (Vec | undefined)[];
  finishX: number | null;
  pearls: Vec[];
  clams: Vec[];
  urchins: Vec[];
  jellies: Vec[];
}

/**
 * Parses a course definition.
 *
 * @throws {LevelError} For ragged rows, unknown characters, missing or duplicate start digits,
 *   no finish tile, finish tiles in more than one column, or a dark zone outside the map or reversed.
 */
export function parseLevel(def: LevelDef): Level {
  const rows = readRows(def.ascii);
  const width = requireEqualWidths(rows);
  const markers: Markers = { starts: [], finishX: null, pearls: [], clams: [], urchins: [], jellies: [] };
  const cells = rows.map((row, y) => [...row].map((ch, x) => readTile(ch, x, y, markers)));

  return {
    name: def.name,
    width,
    height: rows.length,
    cells,
    // Legend glyphs (LevelDef.legend) arrive in lane 8/c; until then every glyph is a built-in one.
    glyphs: rows.map((row) => [...row]),
    starts: requireAllStarts(markers.starts),
    finishX: requireFinish(markers.finishX),
    pearls: markers.pearls,
    clams: markers.clams,
    urchins: markers.urchins,
    jellies: markers.jellies,
    dark: requireDarkZonesOnMap(def.dark ?? [], width),
  };
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
function readTile(ch: string, x: number, y: number, markers: Markers): Cell {
  const terrain = TERRAIN.get(ch);
  if (terrain) return terrain;

  const objectList = OBJECTS.get(ch);
  if (objectList) markers[objectList].push({ x, y });
  else if (START_DIGITS.includes(ch)) recordStart(markers, Number(ch) - 1, x, y);
  else if (ch === FINISH) recordFinish(markers, x, y);
  else throw errorAt(`Unknown tile "${ch}" (expected one of ${VALID_CHARACTERS})`, y, x);
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

function errorAt(what: string, row: number, col: number): LevelError {
  return new LevelError(`${what} at row ${row}, col ${col}`, row, col);
}
