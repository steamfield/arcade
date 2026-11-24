/** Follow Sky Test's low road, then use its cloud cannon to clear the wall. */
import { EventLog, TICK_DT } from '@arcade/core';
import { expect } from '@playwright/test';
import { courseById } from '../src/logic/courses/index.ts';
import type { GameEvent } from '../src/logic/events.ts';
import { FLIGHT_TUNING } from '../src/logic/media/flight/tuning.ts';
import { CANNON } from '../src/logic/setpieces/cannons.ts';
import { courseFromLevel, hold as flightInput, IDLE, placeOnTile, racerOf } from '../src/logic/test-world.ts';
import { RACER_IDS, TILE } from '../src/logic/types.ts';
import { createWorld, stepRace } from '../src/logic/world.ts';
import { HARD_SAVE, hold, scenario, tap, wait } from './kit.ts';

const WALL_END = 133 * TILE;
const FLOOR_TOP = 23 * TILE;
const flapAndCoast = [hold(['right', 'up'], 1), hold('right', 39)];

/** Time to clear the wall from the barrel's centre, with the same flap input in both runs. */
function wallClearTicks(useCannon: boolean): number {
  const sky = courseById('sky-test');
  const cannon = sky?.level.cannons?.[0];
  if (!sky || !cannon) throw new Error('Sky Test needs its cannon for the wall comparison');
  const course = courseFromLevel({ ...sky.level, cannons: useCannon ? [cannon] : [] }, 'flight', {
    world: sky.world,
    ...(sky.tuning ? { tuning: sky.tuning } : {}),
  });
  const world = createWorld(course, new EventLog<GameEvent>(256), {
    seed: 1,
    difficulty: 'hard',
    humans: RACER_IDS,
    endsWhen: 'everyone',
  });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  const player = racerOf(world, 'player');
  placeOnTile(player, cannon.col, cannon.row);
  const cadence = FLIGHT_TUNING.extra.flapCooldownTicks;
  for (let tick = 0; tick < 120; tick++) {
    const playerInput = flightInput({ x: 1, y: tick % cadence === 0 ? -1 : 0 });
    stepRace(world, { player: playerInput, tess: IDLE, squib: IDLE, bo: IDLE }, TICK_DT);
    if (player.body.x >= WALL_END) return tick + 1;
  }
  return Infinity;
}

export default scenario({
  description: "a cloud cannon launches the player over Sky Test's last wall and onto the floor beyond it",
  start: { save: HARD_SAVE, seed: 1, query: { course: 'sky-test', stage: 'cannonball' } },
  input: [
    wait(25),
    tap('fire'),
    wait(25),
    tap('fire'),
    wait(180),
    hold('right', 40),
    hold(['right', 'dash'], 1),
    ...Array.from({ length: 15 }, () => flapAndCoast).flat(),
    // Drop out of the high road just past the turning wind and brake over the barrel.
    hold(['right', 'down'], 6),
    hold(['left', 'down'], 24),
    hold('down', 6),
    hold('right', 35),
    // Shed the shot's momentum so there is room to land before the finish line.
    hold('left', 50),
    wait(165),
  ],
  expect({ events, state }) {
    expect(wallClearTicks(true), 'the cannon clears the wall sooner than flapping from its mouth').toBeLessThan(
      wallClearTicks(false),
    );
    const loaded = events.find((event) => event.type === 'cannon.loaded' && event.racer === 'player');
    const fired = events.find((event) => event.type === 'cannon.fired' && event.racer === 'player');
    expect(loaded).toMatchObject({ cannon: 0 });
    expect(fired).toMatchObject({ cannon: 0, tick: Number(loaded?.tick) + CANNON.holdTicks });
    expect(events.some((event) => event.type === 'cannon.fired' && event.racer !== 'player')).toBe(true);
    const { racers } = state as { racers: { id: string; body: { x: number; y: number; h: number; vy: number } }[] };
    const body = racers.find((racer) => racer.id === 'player')?.body;
    expect(body?.x, 'the whole flyer is beyond the wall').toBeGreaterThan(WALL_END);
    expect((body?.y ?? 0) + (body?.h ?? 0), 'landed on the floor beyond the wall').toBeCloseTo(FLOOR_TOP);
    expect(body?.vy).toBe(0);
  },
});
