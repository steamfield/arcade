/**
 * `TOP_ROUTE` (scenarios/kit.ts) is a blind recording: the scenarios that use it need the player to
 * cross the line before the race ends on its own, and a rival tuning change shifts when that is.
 * This replays it through `stepWorld` so a drifting route fails here, with the numbers, instead of
 * as a confusing scenario failure in the browser.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { TOP_ROUTE } from '../../scenarios/kit.ts';
import { DEFAULT_COURSE } from './courses/index.ts';
import type { GameEvent } from './events.ts';
import { hashWorld } from './hash.ts';
import { COUNTDOWN_TICKS, DNF_GRACE_TICKS, RACE_LIMIT_TICKS } from './race/standings.ts';
import { playerOf } from './racers.ts';
import type { Difficulty, TickInput, World } from './types.ts';
import { createWorld, stepWorld } from './world.ts';

/** Race ticks the player must cross before the DNF cutoff (last rival's finish plus the grace). */
const TOP_ROUTE_MARGIN_TICKS = 300;

/**
 * `hashWorld` of the world on the tick the route crosses the line, on seed 1. A world created the
 * default way must keep racing exactly as it did when this was recorded, so a change that moves
 * this number changed the simulation. The smoke test pins its own number for the browsers, whose
 * replay feeds diagonals differently and steps on past the finish.
 */
const TOP_ROUTE_HASH = 1324527001;

/**
 * `hashWorld` at the end of `busyRace` on each level. The top route never dashes or uses an item,
 * so these pins cover a default world's player doing both, and the rivals racing on after the
 * player is home. Easy and Normal have their own because the rules that protect or chase the
 * player (who may attack whom, clam odds, catch-up) only act there. All three were the same on
 * the commit before worlds could hold several humans; re-pinned when the course gained its surface
 * section and cave, again when racers gained `status.fallen` (with it left out, all four pins
 * hash to the values before it, so the swim simulation did not change), and again with all five
 * when racers gained `status.ringBoost` and the world `ringsPassed` (with both left out, every pin
 * here and the smoke test's hash to the values before them).
 */
const BUSY_RACE_HASHES: readonly [Difficulty, number][] = [
  ['easy', 408151228],
  ['normal', 3612446006],
  ['hard', 3683695234],
];

const KICK_EVERY_TICKS = 45;
const USE_EVERY_TICKS = 20;
const CYCLE_EVERY_TICKS = 97;

/**
 * The default course on seed 1 at `difficulty` until all four finish (or the limit), with the
 * player swimming `TOP_ROUTE`'s moves while dashing, using and cycling items on fixed beats.
 */
function busyRace(difficulty: Difficulty): World {
  const world = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(), {
    seed: 1,
    endsWhen: 'everyone',
    difficulty,
  });
  const moves = TOP_ROUTE.flatMap((step) =>
    Array.from({ length: step.ticks }, () => ({
      x: (step.actions.includes('right') ? 1 : 0) - (step.actions.includes('left') ? 1 : 0),
      y: (step.actions.includes('down') ? 1 : 0) - (step.actions.includes('up') ? 1 : 0),
    })),
  );
  const lastTick = COUNTDOWN_TICKS + RACE_LIMIT_TICKS + 1;
  for (let tick = 0; world.race.phase !== 'finished' && tick < lastTick; tick++) {
    const input: TickInput = {
      move: moves[tick] ?? { x: 1, y: 0 },
      kick: tick % KICK_EVERY_TICKS === 0,
      use: tick % USE_EVERY_TICKS === 0,
      cycle: tick % CYCLE_EVERY_TICKS === 0 ? 1 : 0,
    };
    stepWorld(world, input, TICK_DT);
  }
  return world;
}

/** The default course on seed 1 after `TOP_ROUTE`, stopped on the tick the player finishes. */
function replayTopRoute(): World {
  const world = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(), { seed: 1 });
  const player = playerOf(world);
  for (const step of TOP_ROUTE) {
    const move = {
      x: (step.actions.includes('right') ? 1 : 0) - (step.actions.includes('left') ? 1 : 0),
      y: (step.actions.includes('down') ? 1 : 0) - (step.actions.includes('up') ? 1 : 0),
    };
    for (let tick = 0; tick < step.ticks && !player.finished; tick++) {
      stepWorld(world, { move, kick: false, use: false, cycle: 0 }, TICK_DT);
    }
  }
  return world;
}

describe('TOP_ROUTE on the default seed', () => {
  it('crosses the finish with at least 300 ticks to spare before the DNF cutoff', () => {
    const world = replayTopRoute();
    const player = playerOf(world);

    expect(player.finished, 'the route never crossed the finish line').not.toBeNull();
    // Rivals still racing when the player finishes would only push the cutoff later.
    const cutoff =
      world.race.rivalsDoneAt === null ? Number.POSITIVE_INFINITY : world.race.rivalsDoneAt + DNF_GRACE_TICKS;
    const margin = cutoff - (player.finished?.tick ?? Number.POSITIVE_INFINITY);
    expect(margin, `finished at ${player.finished?.tick}, DNF cutoff at ${cutoff}`).toBeGreaterThanOrEqual(
      TOP_ROUTE_MARGIN_TICKS,
    );
  });

  it.each(BUSY_RACE_HASHES)(
    'on %s, with dashes and items, raced until everyone is home, ends in the pinned world state',
    (difficulty, pinned) => {
      const world = busyRace(difficulty);

      expect(world.race.phase).toBe('finished');
      expect(hashWorld(world)).toBe(pinned);
    },
  );

  it('ends in the pinned world state', () => {
    expect(hashWorld(replayTopRoute())).toBe(TOP_ROUTE_HASH);
  });
});
