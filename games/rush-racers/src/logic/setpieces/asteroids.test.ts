import { describe, expect, it } from 'vitest';
import { invulnerableTicks } from '../difficulty-level.ts';
import { HIT } from '../hazards/tuning.ts';
import { LevelError } from '../level/level-error.ts';
import { parseLevel } from '../level/parse.ts';
import { eventsIn, placeAt, raceOn, racerOf, step, tileCentre } from '../test-world.ts';
import type { AsteroidDef, LevelDef, Vec } from '../types.ts';
import { asteroidAt } from './asteroids.ts';

/** A pool 18 tiles wide and 8 high, starts on the left and the finish on the right. */
const POOL = `
  ##################
  #1...............F
  #2...............F
  #3...............F
  #4...............F
  #................F
  #................F
  ##################
`;

/** An asteroid gliding along row 3 from col 5 to col 13 and back every 120 ticks, unshifted. */
const GLIDER: AsteroidDef = { from: [5, 3], to: [13, 3], periodTicks: 120, offsetTicks: 0, radius: 1 };

function poolWith(...asteroids: AsteroidDef[]): LevelDef {
  return { name: 'belt', ascii: POOL, asteroids };
}

/** The positions rounded to 1/1000 px, so eased fractions compare as numbers. */
const rounded = (point: Vec): Vec => ({ x: Math.round(point.x * 1000) / 1000, y: Math.round(point.y * 1000) / 1000 });

/** The hits on the player so far; rivals swim into the asteroids too, and aren't what these tests watch. */
const playerHits = (log: ReturnType<typeof raceOn>['log']) =>
  eventsIn(log, 'racer.hit').filter((event) => event.type === 'racer.hit' && event.id === 'player');

const distance = (a: Vec, b: Vec) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

describe('parsing asteroids', () => {
  it('keeps a level without asteroids empty and the ones written in order', () => {
    const still: AsteroidDef = { ...GLIDER, from: [8, 5], to: [8, 5] };

    expect(parseLevel({ name: 'none', ascii: POOL }).asteroids).toEqual([]);
    expect(parseLevel(poolWith(GLIDER, still)).asteroids).toEqual([GLIDER, still]);
  });

  it.each([
    ['a start off the map', { from: [5, 8] }, 'An asteroid track ends off the map at row 8, col 5'],
    ['an end off the map', { to: [18, 3] }, 'An asteroid track ends off the map at row 3, col 18'],
    ['an end left of the map', { to: [-1, 3] }, 'An asteroid track ends off the map at row 3, col -1'],
    [
      'a period under a second',
      { periodTicks: 59 },
      "An asteroid's period must be at least 60 ticks, not 59, at row 3, col 5",
    ],
    ['a zero radius', { radius: 0 }, "An asteroid's radius must be positive, not 0, at row 3, col 5"],
    ['a negative radius', { radius: -1 }, "An asteroid's radius must be positive, not -1, at row 3, col 5"],
  ] as const)('throws a LevelError for %s', (_case, change, message) => {
    const parse = () => parseLevel(poolWith({ ...GLIDER, ...change }));

    expect(parse).toThrow(LevelError);
    expect(parse).toThrow(message);
  });
});

describe('where an asteroid is', () => {
  const start = tileCentre(5, 3);
  const end = tileCentre(13, 3);

  it('starts at its first end, reaches the other at half its period and is back after a whole one', () => {
    expect([0, 60, 120, 240].map((tick) => asteroidAt(GLIDER, tick))).toEqual([start, end, start, start]);
  });

  it('is halfway along its track a quarter and three quarters of the way through its period', () => {
    const middle = { x: (start.x + end.x) / 2, y: start.y };

    expect(rounded(asteroidAt(GLIDER, 30))).toEqual(middle);
    expect(rounded(asteroidAt(GLIDER, 90))).toEqual(middle);
  });

  it('is shifted along its cycle by its offset', () => {
    const shifted = { ...GLIDER, offsetTicks: 60 };

    expect(asteroidAt(shifted, 0)).toEqual(end);
    expect(asteroidAt(shifted, 17)).toEqual(asteroidAt(GLIDER, 77));
  });

  it('eases into each turn: slow at the ends, fastest mid-track, and the way back mirrors the way out', () => {
    const stepAt = (tick: number) => distance(asteroidAt(GLIDER, tick), asteroidAt(GLIDER, tick + 1));

    expect(stepAt(0)).toBeLessThan(stepAt(29) / 10);
    expect(stepAt(59)).toBeLessThan(stepAt(29) / 10);
    expect(stepAt(29)).toBeGreaterThan(stepAt(15));
    for (const k of [1, 10, 25])
      expect(rounded(asteroidAt(GLIDER, 60 + k))).toEqual(rounded(asteroidAt(GLIDER, 60 - k)));
  });

  it('runs a track at an angle in a straight line between its ends', () => {
    const diagonal: AsteroidDef = { ...GLIDER, from: [2, 1], to: [10, 5] };
    const at = asteroidAt(diagonal, 30);

    expect(rounded(at)).toEqual({ x: 6.5 * 16, y: 3.5 * 16 });
  });
});

describe('an asteroid hitting racers', () => {
  /** An asteroid that sits on tile (8, 5): a track with both ends there. */
  const ROCK: AsteroidDef = { from: [8, 5], to: [8, 5], periodTicks: 60, offsetTicks: 0, radius: 1 };

  /** Steps one tick with the player put at `at` first, so swimming doesn't carry it off. */
  function stepHeldAt(world: ReturnType<typeof raceOn>['world'], log: ReturnType<typeof raceOn>['log'], at: Vec) {
    placeAt(racerOf(world, 'player'), at);
    step(world, log);
  }

  it('hits a racer it touches, with no owner', () => {
    const { world, log } = raceOn(poolWith(ROCK));
    stepHeldAt(world, log, tileCentre(8, 5));

    expect(playerHits(log)).toEqual([{ type: 'racer.hit', id: 'player', cause: 'asteroid', by: null }]);
  });

  it('hits a racer whose edge is just inside its radius but not one just outside it', () => {
    const rock = tileCentre(8, 5);
    const halfWidth = racerOf(raceOn(poolWith(ROCK)).world, 'player').body.w / 2;
    const hitsAtGap = (gap: number) => {
      const { world, log } = raceOn(poolWith(ROCK));
      stepHeldAt(world, log, { x: rock.x + 16 + halfWidth + gap, y: rock.y });
      return playerHits(log).length;
    };

    expect(hitsAtGap(-2)).toBe(1);
    expect(hitsAtGap(2)).toBe(0);
  });

  it('sweeps into a racer waiting on its track', () => {
    const { world, log } = raceOn(poolWith(GLIDER));
    for (let tick = 0; tick < 30; tick++) stepHeldAt(world, log, tileCentre(9, 3));

    expect(playerHits(log)).toEqual([{ type: 'racer.hit', id: 'player', cause: 'asteroid', by: null }]);
  });

  it('hits a racer held on it once while it is invulnerable, and again once that wears off', () => {
    const { world, log } = raceOn(poolWith(ROCK));
    const invulnerable = invulnerableTicks(world, racerOf(world, 'player'), HIT.invulnerableTicks);
    for (let tick = 0; tick < invulnerable; tick++) stepHeldAt(world, log, tileCentre(8, 5));

    expect(playerHits(log)).toHaveLength(1);

    stepHeldAt(world, log, tileCentre(8, 5));
    expect(playerHits(log)).toHaveLength(2);
  });
});
