import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { COURSES } from '../../logic/courses/index.ts';
import type { GameEvent } from '../../logic/events.ts';
import { hold, IDLE } from '../../logic/test-world.ts';
import type { TickInput, Vec } from '../../logic/types.ts';
import { createWorld, stepWorld } from '../../logic/world.ts';
import { createMovementSense, type SensedMoment } from './movement-sense.ts';

const RIGHT: Vec = { x: 1, y: 0 };
const LEFT: Vec = { x: -1, y: 0 };
const JUMP_RIGHT: Vec = { x: 1, y: -1 };

/**
 * Races the player on test course `course` (countdown skipped) through `steps`, each an input held
 * for some ticks, and lists the moments the sense reported for the player as "tick moment".
 */
function playerMoments(course: 'run-test' | 'drift-test', steps: readonly [TickInput, number][]): string[] {
  const world = createWorld(COURSES[course], new EventLog<GameEvent>(100_000), { seed: 1 });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  const sense = createMovementSense();
  const seen: string[] = [];
  let tick = 0;
  for (const [input, ticks] of steps) {
    for (let step = 0; step < ticks; step++, tick++) {
      stepWorld(world, input, 1 / 60);
      sense.sense(world, (racer, moment: SensedMoment) => {
        if (racer.id === 'player') seen.push(`${tick} ${moment}`);
      });
    }
  }
  return seen;
}

describe('movement sense', () => {
  it('reports a runner landing once when a jump comes down, and not for the drop onto the start line', () => {
    const moments = playerMoments('run-test', [
      [hold(RIGHT), 60],
      [hold(JUMP_RIGHT), 6],
      [hold(RIGHT), 40],
    ]);

    expect(moments.filter((entry) => entry.endsWith('land'))).toHaveLength(1);
    const landedAt = Number(moments.find((entry) => entry.endsWith('land'))?.split(' ')[0]);
    expect(landedAt).toBeGreaterThan(66);
  });

  it('reports a skid when a runner at speed turns round on the ground, once per turn', () => {
    const straight = playerMoments('run-test', [[hold(RIGHT), 60]]);
    const turned = playerMoments('run-test', [
      [hold(RIGHT), 60],
      [hold(LEFT), 20],
    ]);

    expect(straight).toEqual([]);
    expect(turned).toEqual(['60 skid']);
  });

  it('reports a burn on every tick a drifter thrusts, speeding up and holding cruise', () => {
    // Cruise comes about 28 ticks in; 40 ticks stays short of the course's first gravity well.
    const burns = playerMoments('drift-test', [[hold(RIGHT), 40]]);

    // From rest the burn shows once the drifter is past a crawl (10 px/s, two ticks in).
    expect(burns).toEqual(Array.from({ length: 38 }, (_, index) => `${index + 2} thrust`));
  });

  it('reports no burn once a drifter lets go and coasts', () => {
    // Coasting ends before the first gravity well, whose pull would read as a burn.
    const moments = playerMoments('drift-test', [
      [hold(RIGHT), 25],
      [IDLE, 10],
    ]);

    expect(moments.filter((entry) => Number(entry.split(' ')[0]) >= 25)).toEqual([]);
  });
});
