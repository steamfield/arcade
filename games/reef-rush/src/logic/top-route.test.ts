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
import { DNF_GRACE_TICKS } from './race/standings.ts';
import { playerOf } from './racers.ts';
import type { World } from './types.ts';
import { createWorld, stepWorld } from './world.ts';

/** Race ticks the player must cross before the DNF cutoff (last rival's finish plus the grace). */
const TOP_ROUTE_MARGIN_TICKS = 300;

/**
 * `hashWorld` of the world on the tick the route crosses the line, on seed 1. A world created the
 * default way must keep racing exactly as it did when this was recorded, so a change that moves
 * this number changed the simulation. The smoke test pins its own number for the browsers, whose
 * replay feeds diagonals differently and steps on past the finish.
 */
const TOP_ROUTE_HASH = 3381158881;

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

  it('ends in the pinned world state', () => {
    expect(hashWorld(replayTopRoute())).toBe(TOP_ROUTE_HASH);
  });
});
