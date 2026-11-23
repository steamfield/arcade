/**
 * A course's tuning overrides reach the race: `effectiveTuning` lays them over the medium's tuning
 * (`extra` key by key), and the medium moves racers by the result.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { length } from '../num.ts';
import { courseFromLevel, hold, placeOnTile, racerOf } from '../test-world.ts';
import { createWorld, stepWorld } from '../world.ts';
import { effectiveTuning, MEDIA } from './index.ts';

const POOL = `
  ##############################
  #1..........................F#
  #2..........................F#
  #3..........................F#
  #4..........................F#
  ##############################
`;

/** A racing swim world on a course with `tuning` overrides. */
function swimWith(tuning: NonNullable<ReturnType<typeof courseFromLevel>['tuning']>) {
  const course = courseFromLevel(POOL);
  course.tuning = tuning;
  const world = createWorld(course, new EventLog<GameEvent>(100_000), { seed: 1 });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  return world;
}

describe('course tuning', () => {
  it('overrides the medium number by number, and extras key by key', () => {
    const world = swimWith({ maxSpeed: 220, extra: { sink: 0 } });

    expect(effectiveTuning(world)).toEqual({
      ...MEDIA.swim.tuning,
      maxSpeed: 220,
      extra: { ...MEDIA.swim.tuning.extra, sink: 0 },
    });
  });

  it("caps a swimmer at the course's maxSpeed, not swim's own", () => {
    const world = swimWith({ maxSpeed: 220 });
    const player = racerOf(world, 'player');
    placeOnTile(player, 2, 1);
    player.profile = { ...player.profile, forceMul: 6 };
    let top = 0;
    for (let i = 0; i < 90; i++) {
      stepWorld(world, hold({ x: 1, y: 0 }, { kick: true }), TICK_DT);
      top = Math.max(top, length(player.body.vx, player.body.vy));
    }

    expect(top).toBeGreaterThan(MEDIA.swim.tuning.maxSpeed + 20);
    expect(top).toBeLessThanOrEqual(220 + 1e-9);
  });
});
