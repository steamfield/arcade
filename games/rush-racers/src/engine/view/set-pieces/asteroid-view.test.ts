import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../../logic/events.ts';
import { asteroidAt } from '../../../logic/setpieces/asteroids.ts';
import { courseFromLevel } from '../../../logic/test-world.ts';
import { type AsteroidDef, TILE } from '../../../logic/types.ts';
import { createWorld } from '../../../logic/world.ts';
import { asteroidMarks, trackDots } from './asteroid-view.ts';

const ROOM = [
  '#'.repeat(30),
  ...Array.from({ length: 10 }, (_, row) => `#${'1234'[row] ?? '.'}${'.'.repeat(26)}F#`),
  '#'.repeat(30),
].join('\n');

const ACROSS: AsteroidDef = { from: [5, 2], to: [15, 2], periodTicks: 120, offsetTicks: 0, radius: 1 };
const DOWN: AsteroidDef = { from: [20, 1], to: [20, 9], periodTicks: 100, offsetTicks: 30, radius: 1.5 };

/** A world on ROOM with `asteroids`, its race clock at `raceTick`. */
function worldAt(raceTick: number, asteroids: AsteroidDef[]) {
  const world = createWorld(courseFromLevel({ name: 'belt', ascii: ROOM, asteroids }), new EventLog<GameEvent>(100), {
    seed: 1,
  });
  world.race = { ...world.race, raceTick };
  return world;
}

describe('what the race screen draws for drifting asteroids', () => {
  it('is nothing for a level without asteroids', () => {
    expect(asteroidMarks(worldAt(40, []))).toEqual([]);
  });

  it('puts each rock where the logic places it on the race tick, sized by its radius', () => {
    const marks = asteroidMarks(worldAt(40, [ACROSS, DOWN]));

    expect(marks.map(({ x, y, radius }) => ({ x, y, radius }))).toEqual([
      { ...asteroidAt(ACROSS, 40), radius: TILE },
      { ...asteroidAt(DOWN, 40), radius: 1.5 * TILE },
    ]);
  });

  it('turns each rock with the race tick, neighbours opposite ways, and still before the race starts', () => {
    const [still] = asteroidMarks(worldAt(0, [ACROSS, DOWN]));
    const [first, second] = asteroidMarks(worldAt(60, [ACROSS, DOWN]));

    expect(still?.angle).toBe(0);
    expect(first?.angle).toBeGreaterThan(0);
    expect(second?.angle).toBe(-(first?.angle ?? 0));
  });

  it('dots an Easy track line evenly from one end to the other', () => {
    const dots = trackDots(ACROSS);

    expect(dots[0]).toEqual({ x: 5.5 * TILE, y: 2.5 * TILE });
    expect(dots.at(-1)).toEqual({ x: 15.5 * TILE, y: 2.5 * TILE });
    expect(dots).toHaveLength(17);
    expect(new Set(dots.map((dot) => dot.y))).toEqual(new Set([2.5 * TILE]));
  });
});
