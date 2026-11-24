import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../logic/events.ts';
import { GRAVITY_BOMB_TUNING } from '../../logic/powerups/twists/gravity-bomb.ts';
import { courseFromLevel } from '../../logic/test-world.ts';
import { TILE, type Twist } from '../../logic/types.ts';
import { createWorld } from '../../logic/world.ts';
import { gravityBombMarks } from './gravity-bomb-view.ts';

const ROOM = [
  '#'.repeat(30),
  ...Array.from({ length: 10 }, (_, row) => `#${'1234'[row] ?? '.'}${'.'.repeat(26)}F#`),
  '#'.repeat(30),
].join('\n');

const { ttlTicks, reachTiles } = GRAVITY_BOMB_TUNING;

const twist = (fields: Partial<Twist>): Twist => ({
  style: 'gravityBomb',
  owner: 'player',
  x: 200,
  y: 100,
  vx: 0,
  vy: 0,
  ttl: ttlTicks,
  phase: 0,
  ...fields,
});

function worldWith(twists: Twist[]) {
  const world = createWorld(courseFromLevel(ROOM), new EventLog<GameEvent>(100), { seed: 1 });
  world.twists = twists;
  return world;
}

/** The only mark for a single bomb `age` ticks after it was dropped. */
function markAt(age: number, reducedMotion = false) {
  const [mark, ...more] = gravityBombMarks(worldWith([twist({ ttl: ttlTicks - age })]), reducedMotion);
  if (!mark || more.length > 0) throw new Error('expected one gravity bomb mark');
  return mark;
}

describe('what the race screen draws for gravity bombs', () => {
  it('is nothing with no bomb down, and leaves other twist styles to their own views', () => {
    expect(gravityBombMarks(worldWith([]), false)).toEqual([]);
    expect(gravityBombMarks(worldWith([twist({ style: 'mudPie' }), twist({ style: 'headwind' })]), false)).toEqual([]);
  });

  it('centres each bomb where it sits, with its ring at the five-tile reach of its pull', () => {
    const marks = gravityBombMarks(worldWith([twist({ x: 200, y: 100 }), twist({ x: 420, y: 60 })]), false);

    expect(marks.map(({ x, y, reach }) => ({ x, y, reach }))).toEqual([
      { x: 200, y: 100, reach: reachTiles * TILE },
      { x: 420, y: 60, reach: reachTiles * TILE },
    ]);
  });

  it('pulses the core, swelling and shrinking from tick to tick and well inside the reach', () => {
    const cores = [0, 7, 15, 22, 30].map((age) => markAt(age).core);

    expect(cores[1]).toBeGreaterThan(cores[0] ?? 0);
    expect(cores[3]).toBeLessThan(cores[2] ?? 0);
    expect(cores[4]).toBeCloseTo(cores[0] ?? 0, 6);
    expect(Math.max(...cores)).toBeLessThan(TILE);
  });

  it('draws ripples inside the reach that shrink toward the core as the bomb ages', () => {
    const before = markAt(10).ripples;
    const after = markAt(20).ripples;

    expect(before.length).toBeGreaterThan(1);
    expect(before.every((radius) => radius > 0 && radius <= reachTiles * TILE)).toBe(true);
    expect(after.map((radius, i) => radius < (before[i] ?? 0))).toEqual(before.map(() => true));
  });

  it('under reduced motion keeps the core and ring but holds the core still and drops the ripples', () => {
    const still = [0, 7, 22].map((age) => markAt(age, true));

    expect(still.map((mark) => mark.ripples)).toEqual([[], [], []]);
    expect(new Set(still.map((mark) => mark.core)).size).toBe(1);
    expect(still[0]?.core).toBeGreaterThan(0);
    expect(still[0]?.reach).toBe(reachTiles * TILE);
  });
});
