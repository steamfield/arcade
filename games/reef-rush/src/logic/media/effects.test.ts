/**
 * The generic rules that push racers around or read a kick ask the world's medium
 * (`effects`, `kickRules`) instead of assuming water. Each rule runs in swim and in the test-only
 * glide medium, whose answers all differ from swim's, and the outcome follows the medium.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { kickImpulse } from '../abilities.ts';
import { GLIDE_KICK_RULES, GLIDE_MEDIUM } from '../conformance/glide.ts';
import type { GameEvent } from '../events.ts';
import { applyHit } from '../hazards/hits.ts';
import { spawnLoose, updateLoose } from '../pickups/loose.ts';
import { driveDash, fireBurst } from '../powerups/burst.ts';
import { advanceDecoys, spawnDecoy } from '../powerups/decoys.ts';
import { DASH } from '../powerups/tuning.ts';
import { updateProgress } from '../race/standings.ts';
import { centreOf } from '../racers.ts';
import { courseFromLevel, eventsIn, hold, IDLE, placeOnTile, racerOf, step } from '../test-world.ts';
import type { Racer, World } from '../types.ts';
import { createWorld } from '../world.ts';
import { MEDIA, registerMedium } from './index.ts';
import { SWIM_KICK_RULES } from './swim/tuning.ts';

registerMedium(GLIDE_MEDIUM);

const SWIM = MEDIA.swim;

/** Open water with room on every side of the middle. */
const POOL = `
  ###############################
  #1...........................F#
  #2...........................F#
  #3...........................F#
  #4...........................F#
  #............................F#
  #............................F#
  #............................F#
  ###############################
`;

/** A racing world in `medium` on `ascii` with the rivals held still. */
function racingIn(medium: string, ascii = POOL) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(courseFromLevel(ascii, medium), log, { seed: 1 });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  for (const id of ['tess', 'squib', 'bo'] as const) racerOf(world, id).status.stunned = 100_000;
  return { world, log, player: racerOf(world, 'player') };
}

/** The player mid-pool moving at (vx, vy). */
function movingPlayer(world: World, vx: number, vy: number): Racer {
  const player = racerOf(world, 'player');
  placeOnTile(player, 14, 4);
  player.body.vx = vx;
  player.body.vy = vy;
  return player;
}

describe('velocity effects follow effects.dashAxes', () => {
  it('a dash holds both axes in water and only the horizontal in glide', () => {
    const held = ['swim', 'glide'].map((medium) => {
      const { world } = racingIn(medium);
      const player = movingPlayer(world, 0, 25);
      player.status.dashing = 5;
      player.dashDir = { x: 0.6, y: -0.8 };
      driveDash(world, player);
      return { vx: player.body.vx, vy: player.body.vy };
    });

    expect(held).toEqual([
      { vx: 0.6 * DASH.speed, vy: -0.8 * DASH.speed },
      { vx: 0.6 * DASH.speed, vy: 25 },
    ]);
  });

  it('a knockback sets both axes in water and only the horizontal in glide', () => {
    const knocked = ['swim', 'glide'].map((medium) => {
      const { world } = racingIn(medium);
      const player = movingPlayer(world, 0, 25);
      const centre = centreOf(player);
      applyHit(world, player, 'urchin', null, { x: centre.x - 30, y: centre.y + 40 });
      return { vx: Math.sign(player.body.vx), vy: player.body.vy };
    });

    expect(knocked[0]?.vx).toBe(1);
    expect(knocked[0]?.vy).toBeLessThan(0);
    expect(knocked[1]).toEqual({ vx: 1, vy: 25 });
  });

  it('a Mimic decoy follows the way up in every medium, since it is no medium body', () => {
    const shaft = `
      #########
      #......F#
      #.#######
      #.#######
      #1234####
      #########
    `;
    const climbs = ['swim', 'glide'].map((medium) => {
      const { world, player } = racingIn(medium, shaft);
      placeOnTile(player, 1, 3);
      spawnDecoy(world, player, false);
      advanceDecoys(world, TICK_DT);
      return world.decoys[0]?.vy;
    });

    expect(climbs[0]).toBeLessThan(0);
    expect(climbs[1]).toBeLessThan(0);
  });
});

describe('drift effects follow effects.trappedDrift and effects.looseDrift', () => {
  it('a trapped racer floats up in water and falls in glide', () => {
    const drift = ['swim', 'glide'].map((medium) => {
      const { world, log, player } = racingIn(medium);
      movingPlayer(world, 40, 0);
      player.status.trapped = 30;
      step(world, log, 1, IDLE);
      return { vx: player.body.vx, vy: player.body.vy };
    });

    expect(drift).toEqual([
      { vx: 0, vy: SWIM.effects.trappedDrift },
      { vx: 0, vy: GLIDE_MEDIUM.effects.trappedDrift },
    ]);
  });

  it('a loose power-up rises in water and falls in glide', () => {
    const moved = ['swim', 'glide'].map((medium) => {
      const { world } = racingIn(medium);
      spawnLoose(world, 'jetFin', { x: 200, y: 60 });
      updateLoose(world, [], TICK_DT);
      return (world.loose[0]?.y ?? Number.NaN) - 60;
    });

    expect(moved[0]).toBeCloseTo(SWIM.effects.looseDrift * TICK_DT, 9);
    expect(moved[1]).toBeCloseTo(GLIDE_MEDIUM.effects.looseDrift * TICK_DT, 9);
  });
});

describe('kick counters follow kickRules', () => {
  const KICK = hold({ x: 0, y: 0 }, { kick: true });

  it('a kick shakes off a latch in water but not in glide', () => {
    const left = ['swim', 'glide'].map((medium) => {
      const { world, log, player } = racingIn(medium);
      movingPlayer(world, 0, 0);
      player.status.latched = 150;
      step(world, log, 1, KICK);
      return player.status.latched;
    });

    expect(left).toEqual([150 - 30 - 1, 150 - 1]);
  });

  it('a kick cuts an Undertow in water but not in glide', () => {
    const left = ['swim', 'glide'].map((medium) => {
      const { world, log, player } = racingIn(medium);
      movingPlayer(world, 0, 0);
      player.status.undertow = 90;
      player.undertowGapTiles = 12;
      step(world, log, 1, KICK);
      return player.status.undertow;
    });

    expect(left).toEqual([90 - 20 - 1, 90 - 1]);
  });

  it('a kick just before contact dodges a Homing Squid in water but not in glide', () => {
    const dodged = ['swim', 'glide'].map((medium) => {
      const { world, log, player } = racingIn(medium);
      const tess = racerOf(world, 'tess');
      placeOnTile(tess, 4, 2);
      placeOnTile(player, 14, 2);
      updateProgress(world);
      tess.stack = ['homingSquid'];
      fireBurst(world, tess, { x: 1, y: 0 });
      for (let tick = 0; tick < 200 && squidGap(world, player) > 30; tick++) step(world, log, 1, IDLE);
      step(world, log, 1, KICK);
      step(world, log, 40, IDLE);
      return eventsIn(log, 'squid.dodged', 'squid.latched').map((event) => event.type);
    });

    expect(dodged).toEqual([['squid.dodged'], ['squid.latched']]);
  });

  it("Gil's spring kick takes the medium's word for which kicks it applies to", () => {
    const gil = racerOf(racingIn('swim').world, 'player');
    gil.character = 'gil';
    const steepDiagonal = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
    const straightUp = { x: 0, y: -1 };

    expect(kickImpulse(gil, steepDiagonal, SWIM_KICK_RULES).y).toBeLessThan(-1);
    expect(kickImpulse(gil, steepDiagonal, GLIDE_KICK_RULES)).toEqual(steepDiagonal);
    expect(kickImpulse(gil, straightUp, GLIDE_KICK_RULES).y).toBeLessThan(-1);
  });
});

function squidGap(world: World, racer: Racer): number {
  const squid = world.squids[0];
  if (!squid) return Number.POSITIVE_INFINITY;
  const centre = centreOf(racer);
  return Math.hypot(centre.x - squid.x, centre.y - squid.y);
}
