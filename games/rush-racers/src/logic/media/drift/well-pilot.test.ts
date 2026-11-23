/**
 * Rivals and gravity wells: the way to the finish keeps out of a black hole's horizon and clear of
 * its reach where there is room, a level whose only way crosses a horizon is refused, and the pilot
 * stays out of holes, flies out of a reach it was dropped in, loses no time to a planet on the
 * inside of a bend, and gets round Drift Test. Raced through `createWorld`.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../../ai/profiles.ts';
import { COURSES, levelOf } from '../../courses/index.ts';
import type { GameEvent } from '../../events.ts';
import { LevelError } from '../../level/parse.ts';
import { centreOf } from '../../racers.ts';
import { courseFromLevel, IDLE, placeOnTile, racerOf, step } from '../../test-world.ts';
import { RACER_IDS, TILE, type Vec, type WellDef } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { ticksOfRacer } from './test-kit.ts';
import { driftDistanceAt, driftNextTile } from './way.ts';

const SEEDS = [1, 2, 3, 4, 5];
const wellCentre = (well: WellDef): Vec => ({ x: (well.col + 0.5) * TILE, y: (well.row + 0.5) * TILE });
const distance = (a: Vec, b: Vec) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

/** `rows` open rows `width` tiles wide between two walls, starts in the left column from `startRow` down. */
function room(width: number, rows: number, startRow: number): string {
  const open = Array.from({ length: rows }, (_, row) => {
    const start = '1234'[row - startRow] ?? '.';
    return `#${start}${'.'.repeat(width - 4)}F#`;
  });
  return ['#'.repeat(width), ...open, '#'.repeat(width)].join('\n');
}

/**
 * A racing world on an inline drift level with tess on tile `at`; every other racer is held still
 * where it starts. `steady` gives tess no wobble, a reaction every tick and no dashes.
 */
function tessOn(ascii: string, wells: readonly WellDef[], at: Vec, options: { seed?: number; steady?: boolean } = {}) {
  const log = new EventLog<GameEvent>(100_000);
  const course = courseFromLevel({ name: 'test', ascii, wells }, 'drift', { catchUp: { hard: { min: 1, max: 1 } } });
  const world = createWorld(course, log, { seed: options.seed ?? 1, endsWhen: 'everyone' });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  const tess = racerOf(world, 'tess');
  if (options.steady ?? true) tess.profile = { ...tess.profile, kickSkill: 0, wobble: 0, reactionTicks: 1 };
  for (const racer of world.racers) if (racer !== tess) racer.status.trapped = 100_000;
  placeOnTile(tess, at.x, at.y);
  return { world, log, tess };
}

describe('the way to the finish round a black hole', () => {
  /** A room 15 rows high with a hole in the middle of it, on the row the starts are level with. */
  const ROOM = room(40, 15, 5);
  const HOLE: WellDef = { col: 20, row: 8, reach: 3, pull: 300, horizon: 1.5 };

  it('never enters a tile whose centre is inside the horizon', () => {
    const { world } = tessOn(ROOM, [HOLE], { x: 6, y: 8 });

    expect(driftDistanceAt(world, { x: HOLE.col, y: HOLE.row })).toBe(Number.POSITIVE_INFINITY);
    expect(driftDistanceAt(world, { x: HOLE.col + 1, y: HOLE.row })).toBe(Number.POSITIVE_INFINITY);
    expect(driftDistanceAt(world, { x: HOLE.col + 3, y: HOLE.row })).toBeLessThan(Number.POSITIVE_INFINITY);
  });

  it('goes round the whole reach where there is room, from a tile dead in line with the hole', () => {
    const { world } = tessOn(ROOM, [HOLE], { x: 6, y: 8 });
    const inReach: string[] = [];
    let tile = { x: 10, y: HOLE.row };
    for (let steps = 0; steps < 80 && tile.x < 30; steps++) {
      const next = driftNextTile(world, tile);
      if (!next) break;
      tile = { x: tile.x + next.x, y: tile.y + next.y };
      const centre = { x: (tile.x + 0.5) * TILE, y: (tile.y + 0.5) * TILE };
      if (distance(centre, wellCentre(HOLE)) < HOLE.reach * TILE) inReach.push(`${tile.x},${tile.y}`);
    }

    expect(tile.x).toBeGreaterThanOrEqual(30);
    expect(inReach).toEqual([]);
  });

  it('refuses a level whose only way to the finish crosses a horizon', () => {
    const corridor = room(40, 4, 0);
    const plug: WellDef = { col: 20, row: 2, reach: 4, pull: 300, horizon: 3 };
    const start = () => tessOn(corridor, [plug], { x: 6, y: 2 });

    expect(start).toThrow(LevelError);
  });
});

describe('the drift pilot near a black hole', () => {
  /** A corridor 8 rows high; the hole sits in its ceiling, its reach covering the top half. */
  const CORRIDOR = room(50, 8, 4);
  const CEILING_HOLE: WellDef = { col: 25, row: 0, reach: 4.5, pull: 300, horizon: 1.5 };
  /** Past this x the rival has cleared the hole. */
  const CLEAR_X = 34 * TILE;

  it('keeps to the far half of the corridor while it passes, and is never swallowed', () => {
    const { world, log, tess } = tessOn(CORRIDOR, [CEILING_HOLE], { x: 6, y: 3 });
    const inReach: string[] = [];
    let ticks = 0;
    for (; ticks < 900 && centreOf(tess).x < CLEAR_X; ticks++) {
      step(world, log, 1, IDLE);
      const centre = centreOf(tess);
      if (distance(centre, wellCentre(CEILING_HOLE)) < CEILING_HOLE.reach * TILE) {
        inReach.push(`tick ${ticks}: ${Math.round(centre.x)},${Math.round(centre.y)}`);
      }
    }

    expect(ticks).toBeLessThan(900);
    expect(inReach).toEqual([]);
    expect(ticksOfRacer(log, 'racer.fell', 'tess')).toEqual([]);
  });

  it.each(SEEDS)('gets past with its own profile without being swallowed, seed %i', (seed) => {
    const { world, log, tess } = tessOn(CORRIDOR, [CEILING_HOLE], { x: 6, y: 3 }, { seed, steady: false });
    let ticks = 0;
    for (; ticks < 900 && centreOf(tess).x < CLEAR_X; ticks++) step(world, log, 1, IDLE);

    expect(ticks).toBeLessThan(900);
    expect(ticksOfRacer(log, 'racer.fell', 'tess')).toEqual([]);
  });

  it('flies out when dropped at rest inside the reach, between the hole and the finish it wants', () => {
    const open = room(40, 15, 5);
    const hole: WellDef = { col: 20, row: 8, reach: 4, pull: 300, horizon: 1.5 };
    const { world, log, tess } = tessOn(open, [hole], { x: hole.col - 3, y: hole.row });
    let ticks = 0;
    for (; ticks < 300 && distance(centreOf(tess), wellCentre(hole)) < hole.reach * TILE; ticks++) {
      step(world, log, 1, IDLE);
    }

    expect(ticks).toBeLessThan(300);
    expect(ticksOfRacer(log, 'racer.fell', 'tess')).toEqual([]);
  });
});

describe('the drift pilot round a planet', () => {
  /**
   * Along a corridor five rows high, up a shaft five wide, then right along the top to the finish.
   * The rock inside the first bend is where the planet sits.
   */
  const BEND = (() => {
    const grid = Array.from({ length: 22 }, () => Array.from({ length: 48 }, () => '#'));
    const carve = (fromCol: number, toCol: number, fromRow: number, toRow: number) => {
      for (let row = fromRow; row <= toRow; row++)
        for (let col = fromCol; col <= toCol; col++) (grid[row] ?? [])[col] = '.';
    };
    carve(1, 34, 15, 19);
    carve(30, 34, 2, 19);
    carve(30, 46, 2, 6);
    for (let row = 2; row <= 6; row++) (grid[row] ?? [])[46] = 'F';
    [...'1234'].forEach((digit, index) => {
      (grid[17] ?? [])[1 + index] = digit;
    });
    return grid.map((row) => row.join('')).join('\n');
  })();
  const PLANET: WellDef = { col: 27, row: 12, reach: 6, pull: 160 };

  /** Ticks tess takes from the start of the corridor to the finish. */
  function lap(wells: readonly WellDef[]): number {
    const { world, log, tess } = tessOn(BEND, wells, { x: 6, y: 17 });
    let ticks = 0;
    for (; ticks < 1500 && tess.finished === null; ticks++) step(world, log, 1, IDLE);
    return ticks;
  }

  it('takes a bend with a planet inside it no more than 3 % slower than the same bend without one', () => {
    const without = lap([]);
    const withPlanet = lap([PLANET]);

    expect(without).toBeLessThan(1500);
    expect(withPlanet).toBeLessThanOrEqual(Math.ceil(without * 1.03));
  });
});

describe('Drift Test with its planet and its black hole', () => {
  const course = COURSES['drift-test'];

  it('has at least one planet and one black hole', () => {
    const { wells } = levelOf(course);

    expect(wells.some((well) => well.horizon === null)).toBe(true);
    expect(wells.some((well) => well.horizon !== null)).toBe(true);
  });

  it.each(SEEDS)('is finished by every racer, none swallowed more than once, seed %i', (seed) => {
    const log = new EventLog<GameEvent>(200_000);
    const world = createWorld(course, log, { seed, playerBot: BOT_PROFILES.expert, endsWhen: 'everyone' });
    const limit = Math.ceil(course.parTicks * 1.6) + 300;
    for (let ticks = 0; ticks < limit && world.race.phase !== 'finished'; ticks++) step(world, log, 1, IDLE);
    const swallowed = RACER_IDS.map((id) => `${id}: ${ticksOfRacer(log, 'racer.fell', id).length}`);

    expect(world.racers.filter((racer) => racer.finished === null).map((racer) => racer.id)).toEqual([]);
    expect(swallowed.filter((line) => !line.endsWith(': 0') && !line.endsWith(': 1'))).toEqual([]);
  });
});
