import { EventLog, TICK_DT } from '@arcade/core';
import { expect } from '@playwright/test';
import { z } from 'zod';
import { courseById } from '../src/logic/courses/index.ts';
import type { GameEvent } from '../src/logic/events.ts';
import { COUNTDOWN_TICKS } from '../src/logic/race/standings.ts';
import { playerOf } from '../src/logic/racers.ts';
import { TILE } from '../src/logic/types.ts';
import { createWorld, stepWorld } from '../src/logic/world.ts';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

const COURSE = 'reef-test';
const SEED = 1;
/** Capture while the rider still has the speed it carried out of the rim. */
const RIDE_TICKS = 258;
const RACER_STATE = z.object({
  racers: z.array(
    z.object({
      id: z.string(),
      body: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number(), vx: z.number() }),
    }),
  ),
});

/** A second swimmer from the same grid steers above the pool, then holds right outside the rim. */
function bypass() {
  const course = courseById(COURSE);
  if (!course) throw new Error(`Missing course ${COURSE}`);
  const log = new EventLog<GameEvent>(1000);
  const world = createWorld(course, log, {
    seed: SEED,
    character: HARD_SAVE.data.character,
    difficulty: HARD_SAVE.data.settings.difficulty,
  });
  for (let tick = 0; tick < COUNTDOWN_TICKS + RIDE_TICKS; tick++) {
    stepWorld(
      world,
      { move: { x: 1, y: tick < COUNTDOWN_TICKS + 59 ? -1 : 0 }, kick: false, use: false, cycle: 0 },
      TICK_DT,
    );
  }
  expect(log.all().some((event) => event.type === 'whirlpool.caught' && event.racer === 'player')).toBe(false);
  expect(log.all().some((event) => event.type === 'pearl.collected' && event.id === 'player')).toBe(false);
  return world;
}

export default scenario({
  description: 'a swimmer riding the whirlpool comes out ahead of a swimmer going round',
  start: { save: HARD_SAVE, seed: SEED, query: { course: COURSE } },
  input: [wait(25), tap('fire'), wait(25), tap('fire'), wait(COUNTDOWN_TICKS), hold('right', RIDE_TICKS)],
  expect({ events, state, summary }) {
    const world = bypass();
    expect(summary).toMatchObject({ scene: 'race', course: COURSE, raceTick: world.race.raceTick, pearls: 0 });

    const catches = events.filter((event) => event.type === 'whirlpool.caught');
    expect(catches.filter((event) => event.racer === 'player')).toMatchObject([{ pool: 0 }]);
    const pool = world.level.whirlpools[0];
    const { racers } = RACER_STATE.parse(state);
    const rider = racers.find(({ id }) => id === 'player');
    if (!pool || !rider) throw new Error('Reef Test needs a player and a whirlpool');

    const eye = { x: (pool.col + 0.5) * TILE, y: (pool.row + 0.5) * TILE };
    const dx = rider.body.x + rider.body.w / 2 - eye.x;
    const dy = rider.body.y + rider.body.h / 2 - eye.y;
    expect(dx).toBeGreaterThan(0);
    expect(dy).toBeLessThan(0);
    expect(Math.hypot(dx, dy)).toBeGreaterThan(pool.radius * TILE);
    const around = playerOf(world).body;
    expect(Math.round(rider.body.x - around.x), 'lead at the exit').toBeGreaterThan(TILE);
    expect(Math.round(rider.body.vx - around.vx), 'extra forward speed coming out').toBeGreaterThan(10);
    expect(
      racers.some(
        ({ id, body }) =>
          id !== 'player' &&
          catches.some((event) => event.racer === id) &&
          body.x > eye.x &&
          body.y + body.h / 2 < eye.y,
      ),
      'a rival also rode through the forward side',
    ).toBe(true);
  },
});
