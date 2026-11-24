/**
 * Gravity wells as level data: how `LevelDef.wells` parses, what bad well data throws, the pull at
 * a point, which points a black hole holds, and which media may race a level that has wells.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { courseFromLevel } from '../test-world.ts';
import { TILE, type WellDef } from '../types.ts';
import { createWorld } from '../world.ts';
import { LevelError, parseLevel } from './parse.ts';
import { holeAt, inHoleReach, pullAt } from './wells.ts';

/** An open room 30 tiles wide and 14 high, starts in its left column. */
const ROOM = [
  '#'.repeat(30),
  ...Array.from({ length: 12 }, (_, row) => `#${'1234'[row] ?? '.'}${'.'.repeat(26)}F#`),
  '#'.repeat(30),
].join('\n');

const PLANET: WellDef = { col: 12, row: 6, reach: 4, pull: 300 };
const HOLE: WellDef = { col: 20, row: 7, reach: 3, pull: 200, horizon: 1 };

const levelWith = (...wells: WellDef[]) => parseLevel({ name: 'wells', ascii: ROOM, wells });
const centreOf = (well: WellDef) => ({ x: (well.col + 0.5) * TILE, y: (well.row + 0.5) * TILE });

/** The LevelError `wells` raise when parsed, or null. */
function parseError(...wells: WellDef[]): LevelError | null {
  try {
    levelWith(...wells);
  } catch (error) {
    if (error instanceof LevelError) return error;
    throw error;
  }
  return null;
}

describe('parsing wells', () => {
  it('gives a level without any an empty list', () => {
    expect(parseLevel({ name: 'none', ascii: ROOM }).wells).toEqual([]);
  });

  it('centres each well on its tile, with reach and horizon in pixels and no horizon for a planet', () => {
    expect(levelWith(PLANET, HOLE).wells).toEqual([
      { centre: centreOf(PLANET), reach: 4 * TILE, pull: 300, horizon: null },
      { centre: centreOf(HOLE), reach: 3 * TILE, pull: 200, horizon: TILE },
    ]);
  });

  it.each([
    ['a centre off the map', { ...PLANET, col: 30 }],
    ['a centre above the map', { ...PLANET, row: -1 }],
    ['a reach of zero', { ...PLANET, reach: 0 }],
    ['a negative pull', { ...PLANET, pull: -5 }],
    ['a horizon of zero', { ...HOLE, horizon: 0 }],
    ['a horizon as wide as its reach', { ...HOLE, horizon: 3 }],
  ])('throws a LevelError at the well for %s', (_name, well) => {
    const error = parseError(PLANET, well);

    expect(error).toBeInstanceOf(LevelError);
    expect(error).toMatchObject({ row: well.row, col: well.col });
    expect(error?.message).toContain(`row ${well.row}, col ${well.col}`);
  });
});

describe('the pull at a point', () => {
  const level = levelWith(PLANET);
  const centre = centreOf(PLANET);
  const reach = PLANET.reach * TILE;

  it('is nothing at the reach, beyond it, and exactly at the centre', () => {
    expect(pullAt(level, { x: centre.x + reach, y: centre.y })).toEqual({ x: 0, y: 0 });
    expect(pullAt(level, { x: centre.x, y: centre.y - reach - 40 })).toEqual({ x: 0, y: 0 });
    expect(pullAt(level, centre)).toEqual({ x: 0, y: 0 });
  });

  it('points at the centre and grows evenly from nothing at the reach to the full pull at the centre', () => {
    const half = pullAt(level, { x: centre.x + reach / 2, y: centre.y });
    const near = pullAt(level, { x: centre.x, y: centre.y + reach / 4 });

    expect(half.x).toBeCloseTo(-PLANET.pull / 2, 6);
    expect(half.y).toBeCloseTo(0, 6);
    expect(near.x).toBeCloseTo(0, 6);
    expect(near.y).toBeCloseTo(-PLANET.pull * 0.75, 6);
  });

  it('points along the diagonal from a point off both axes', () => {
    const pull = pullAt(level, { x: centre.x - 24, y: centre.y - 24 });

    expect(pull.x).toBeGreaterThan(0);
    expect(pull.y).toBeCloseTo(pull.x, 6);
  });

  it('adds the pulls of wells whose reaches overlap', () => {
    const twin: WellDef = { ...PLANET, col: PLANET.col + 4 };
    const both = levelWith(PLANET, twin);
    const midway = { x: (centre.x + centreOf(twin).x) / 2, y: centre.y + 10 };
    const one = pullAt(levelWith(PLANET), midway);
    const other = pullAt(levelWith(twin), midway);

    expect(pullAt(both, midway).x).toBeCloseTo(one.x + other.x, 6);
    expect(pullAt(both, midway).y).toBeCloseTo(one.y + other.y, 6);
    expect(pullAt(both, midway).x).toBeCloseTo(0, 6);
    expect(pullAt(both, midway).y).toBeLessThan(0);
  });
});

describe('a black hole', () => {
  const level = levelWith(PLANET, HOLE);
  const hole = centreOf(HOLE);

  it('holds a point inside its horizon and none outside it', () => {
    expect(holeAt(level, { x: hole.x + 6, y: hole.y - 6 })).toBe(level.wells[1]);
    expect(holeAt(level, { x: hole.x + TILE + 2, y: hole.y })).toBeNull();
  });

  it('is never a planet, however close to its centre the point is', () => {
    expect(holeAt(level, centreOf(PLANET))).toBeNull();
  });

  it('has a reach that planets do not count toward', () => {
    expect(inHoleReach(level, { x: hole.x + 2 * TILE, y: hole.y })).toBe(true);
    expect(inHoleReach(level, { x: hole.x + 3 * TILE + 1, y: hole.y })).toBe(false);
    expect(inHoleReach(level, { x: centreOf(PLANET).x + TILE, y: centreOf(PLANET).y })).toBe(false);
  });
});

describe('racing a level with wells', () => {
  const start = (level: { ascii: string; wells: WellDef[] }, medium: string) =>
    createWorld(courseFromLevel({ name: 'wells', ...level }, medium), new EventLog<GameEvent>(100), { seed: 1 });

  it('works in drift', () => {
    expect(start({ ascii: ROOM, wells: [PLANET, HOLE] }, 'drift').level.wells).toHaveLength(2);
  });

  it('throws a LevelError naming the medium when it has no gravity wells', () => {
    expect(() => start({ ascii: ROOM, wells: [PLANET] }, 'swim')).toThrow(LevelError);
    expect(() => start({ ascii: ROOM, wells: [PLANET] }, 'swim')).toThrow(/'swim' has no gravity wells/);
  });

  it("throws a LevelError at a start tile inside a black hole's reach, and not for one inside a planet's", () => {
    const overStart: WellDef = { col: 3, row: 2, reach: 3, pull: 200, horizon: 1 };
    let thrown: unknown;
    try {
      start({ ascii: ROOM, wells: [overStart] }, 'drift');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(LevelError);
    expect(thrown).toMatchObject({ row: 1, col: 1 });
    expect(() => start({ ascii: ROOM, wells: [{ col: 3, row: 2, reach: 3, pull: 200 }] }, 'drift')).not.toThrow();
  });
});
