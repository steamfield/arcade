/**
 * A drift rival meeting a drifting asteroid that sweeps across its corridor: it slows, stopping if it
 * must, so the asteroid passes ahead of it, and then flies on. Raced through `createWorld` on an
 * inline course with every other racer held still.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { centreOf } from '../../racers.ts';
import { courseFromLevel, eventsIn, IDLE, placeOnTile, racerOf, step } from '../../test-world.ts';
import { type AsteroidDef, TILE } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { asteroidPace } from './asteroid-wait.ts';

/** A corridor nine rows high and 70 long, open all the way. */
const OPEN = [
  '#'.repeat(72),
  ...Array.from({ length: 9 }, (_, row) => `#${row === 4 ? '1234' : '....'}${'.'.repeat(65)}F#`),
  '#'.repeat(72),
].join('\n');

/**
 * An asteroid sweeping the corridor from its top row to its bottom row at col 16, timed to be
 * crossing the middle of it as a rival from col 6 arrives.
 */
const SWEEPER: AsteroidDef = { from: [16, 1], to: [16, 9], periodTicks: 200, offsetTicks: 150, radius: 1 };

/** A racing world on OPEN with `asteroids`, tess steady on tile (6, 5) and every other racer held still. */
function tessFacing(asteroids: readonly AsteroidDef[]) {
  const log = new EventLog<GameEvent>(100_000);
  const course = courseFromLevel({ name: 'sweep', ascii: OPEN, asteroids }, 'drift', {
    catchUp: { hard: { min: 1, max: 1 } },
  });
  const world = createWorld(course, log, { seed: 1, endsWhen: 'everyone' });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  const tess = racerOf(world, 'tess');
  tess.profile = { ...tess.profile, kickSkill: 0, wobble: 0, reactionTicks: 1 };
  for (const racer of world.racers) if (racer !== tess) racer.status.trapped = 100_000;
  placeOnTile(tess, 6, 5);
  return { world, log, tess };
}

/** Flies tess for `ticks` ticks; returns its slowest speed after its first second and where it ends. */
function fly(setup: ReturnType<typeof tessFacing>, ticks: number) {
  let slowest = Number.POSITIVE_INFINITY;
  for (let tick = 0; tick < ticks; tick++) {
    step(setup.world, setup.log, 1, IDLE);
    if (tick >= 60)
      slowest = Math.min(
        slowest,
        Math.sqrt(setup.tess.body.vx * setup.tess.body.vx + setup.tess.body.vy * setup.tess.body.vy),
      );
  }
  return { slowest, col: Math.floor(centreOf(setup.tess).x / TILE) };
}

describe('a drift rival and a crossing asteroid', () => {
  it('slows to let an asteroid sweeping across its way pass ahead of it, then flies on past it unhit', () => {
    const clear = fly(tessFacing([]), 300);
    const setup = tessFacing([SWEEPER]);
    const swept = fly(setup, 300);

    expect(eventsIn(setup.log, 'racer.hit')).toEqual([]);
    expect(swept.slowest).toBeLessThan(clear.slowest * 0.6);
    expect(swept.col).toBeGreaterThan(SWEEPER.from[0] + 4);
  });

  it('holds back only a rival: a bot driving the player slot in the same spot flies on at full pace', () => {
    const { world, tess } = tessFacing([SWEEPER]);
    const player = racerOf(world, 'player');
    // Both sit two tiles before the sweeper's track, wanting to fly at it as it crosses their row.
    world.race.raceTick = 85;
    placeOnTile(tess, 14, 5);
    placeOnTile(player, 14, 5);
    const atSweeper = { x: 120, y: 0 };

    expect(asteroidPace(world, tess, atSweeper)).toBeLessThan(1);
    expect(asteroidPace(world, player, atSweeper)).toBe(1);
  });
});
