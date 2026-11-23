/**
 * Puff clouds (coral) in flight: a dash pops one it touches during its `dashTicks` window, from any
 * side, through the generic `Medium.ramsCoral` seam; speed alone never does. Raced through
 * `createWorld` on small inline courses with the rivals walled off in their own lane.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { GLIDE_MEDIUM } from '../../conformance/glide.ts';
import type { GameEvent } from '../../events.ts';
import { courseFromLevel, eventsIn, hold, racerOf, step } from '../../test-world.ts';
import { type Racer, TILE } from '../../types.ts';
import { createWorld, stepWorld } from '../../world.ts';
import { MEDIA, mediumById, registerMedium } from '../index.ts';
import { flightWorld, RIVAL_LANE_ROWS } from './test-kit.ts';
import { FLIGHT_TUNING } from './tuning.ts';

registerMedium(GLIDE_MEDIUM);

const { dashTicks } = FLIGHT_TUNING.extra;
const RIGHT = hold({ x: 1, y: 0 });
const DASH_RIGHT = hold({ x: 1, y: 0 }, { kick: true });

/** A puff cloud wall at col 8 on a floor, two tiles high, with a way over its top. */
const PUFF_WALL = ['..............F', '..............F', '........C.....F', '.1......C.....F', '###############'];
/** Level row of the player's floor-level row in `PUFF_WALL`. */
const FLOOR_ROW = RIVAL_LANE_ROWS + 3;
const WALL_COLUMN = 8;

/** Puts `racer` 1 px left of the wall on the floor, keeping its velocity. */
function besideWall(racer: Racer): void {
  racer.body.x = WALL_COLUMN * TILE - racer.body.w - 1;
  racer.body.y = (FLOOR_ROW + 1) * TILE - racer.body.h;
}

/**
 * Dashes on the floor at the start, flies right for `ticksAfterDash - 1` ticks, then is put beside
 * the wall and steps once more holding right: that last step is `ticksAfterDash` ticks after the dash.
 */
function reachWallAfter(ticksAfterDash: number) {
  const race = flightWorld(PUFF_WALL);
  const { world, log, player } = race;
  step(world, log, 1, DASH_RIGHT);
  step(world, log, ticksAfterDash - 1, RIGHT);
  besideWall(player);
  step(world, log, 1, RIGHT);
  return race;
}

describe('a dash through a puff cloud', () => {
  it('pops one beside it on the tick the dash starts, and flies on through', () => {
    const { world, log, player } = flightWorld(PUFF_WALL);
    besideWall(player);
    step(world, log, 1, DASH_RIGHT);

    expect(eventsIn(log, 'coral.broken')).toEqual([
      { type: 'coral.broken', tx: WALL_COLUMN, ty: FLOOR_ROW, by: 'player' },
    ]);
    step(world, log, 20, RIGHT);
    expect(player.body.x).toBeGreaterThan((WALL_COLUMN + 1) * TILE);
  });

  it(`pops one it reaches on the last tick of its ${dashTicks}-tick window`, () => {
    const { log } = reachWallAfter(dashTicks - 1);

    expect(eventsIn(log, 'coral.broken')).toEqual([
      { type: 'coral.broken', tx: WALL_COLUMN, ty: FLOOR_ROW, by: 'player' },
    ]);
  });

  it('is blocked by one it reaches a tick after the window', () => {
    const { log, player } = reachWallAfter(dashTicks);

    expect(eventsIn(log, 'coral.broken')).toEqual([]);
    expect(player.body.x + player.body.w).toBeLessThanOrEqual(WALL_COLUMN * TILE);
  });

  it('is blocked when it only carries speed, as from a dive, without dashing', () => {
    const { world, log, player } = flightWorld(PUFF_WALL);
    besideWall(player);
    player.body.vx = FLIGHT_TUNING.maxSpeed;
    step(world, log, 1, RIGHT);

    expect(eventsIn(log, 'coral.broken')).toEqual([]);
    expect(player.body.x + player.body.w).toBeLessThanOrEqual(WALL_COLUMN * TILE);
  });

  it('pops one under a dashing flyer that falls onto it', () => {
    const { world, log, player } = flightWorld([
      '..............F',
      '..............F',
      '.1............F',
      '#####CCC#######',
    ]);
    const puffRow = RIVAL_LANE_ROWS + 3;
    player.body.x = 6 * TILE;
    player.body.y = puffRow * TILE - player.body.h - 1;
    player.body.vy = FLIGHT_TUNING.extra.maxFall;
    step(world, log, 1, DASH_RIGHT);

    expect(eventsIn(log, 'coral.broken')).toContainEqual({ type: 'coral.broken', tx: 6, ty: puffRow, by: 'player' });
  });
});

describe('ramsCoral in the other media', () => {
  const FLOOR = `
    ##############
    #............#
    #1.2.3.4....F#
    ##############
  `;

  it.each(['swim', 'run', 'glide'])('is false in %s, even straight after a kick', (id) => {
    const medium = mediumById(id);
    if (!medium) throw new Error(`No medium '${id}'`);
    const log = new EventLog<GameEvent>(10_000);
    const world = createWorld(courseFromLevel(FLOOR, id), log, { seed: 1 });
    world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
    const player = racerOf(world, 'player');
    const answers = Array.from({ length: 10 }, () => {
      stepWorld(world, DASH_RIGHT, TICK_DT);
      return medium.ramsCoral(player);
    });

    expect(eventsIn(log, 'racer.kicked').length).toBeGreaterThan(0);
    expect(answers).toEqual(answers.map(() => false));
  });

  it('is true in flight straight after a dash', () => {
    const { world, log, player } = flightWorld(PUFF_WALL);
    step(world, log, 1, DASH_RIGHT);

    expect(MEDIA.flight.ramsCoral(player)).toBe(true);
  });
});
