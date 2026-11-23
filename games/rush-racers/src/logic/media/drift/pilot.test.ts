/**
 * Drift's rival pilot: it flies a body with momentum. It slows before the wall at the end of a
 * straight, straightens a sideways drift, keeps speed it was given, dashes only with room ahead,
 * goes round a parked racer, and its profile's `wobble` and `reactionTicks` change what it does.
 * Raced through `createWorld` on small inline courses with every other racer held still, or steered
 * one call at a time through `DRIFT_MEDIUM.steer` where the test needs to count calls.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { courseFromLevel, IDLE, placeOnTile, racerOf, step } from '../../test-world.ts';
import { TILE } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { effectiveTuning } from '../index.ts';
import type { AiDraws } from '../types.ts';
import { DRIFT_MEDIUM } from './index.ts';
import { DRIFT_TUNING } from './tuning.ts';

const { force, maxSpeed } = DRIFT_TUNING;
const { cruise } = DRIFT_TUNING.extra;

/** A long corridor three rows high into a dead end, with a shaft three wide up to the finish in its top corner. */
const STRAIGHT_THEN_UP = `
  ######################################
  #################################...F#
  #################################...##
  #################################...##
  #################################...##
  #...................................##
  #1234...............................##
  #...................................##
  ######################################
`;
/** The column of the wall the straight ends at. */
const END_WALL_COL = 36;

/** A corridor nine rows high and 70 long, open all the way. */
const OPEN = [
  '#'.repeat(72),
  ...Array.from({ length: 9 }, (_, row) => `#${row === 4 ? '1234' : '....'}${'.'.repeat(65)}F#`),
  '#'.repeat(72),
].join('\n');

/** Along the bottom from the starts, up a one-wide shaft at col 6, then along the top to the finish. */
const CORNER_UP = `
  ############
  ######....F#
  ######.#####
  ######.#####
  ######.#####
  #1234..#####
  ############
`;

/** Draws that never dash and put no jitter on the aim. */
const STEADY: AiDraws = { wobble: 0.5, kick: 1, side: 0, item: 1 };
/** Draws whose dash roll always passes. */
const KEEN: AiDraws = { ...STEADY, kick: 0 };

/**
 * A racing world on an inline drift level with tess on tile `at`, steady (no wobble, reacting every
 * tick) and never dashing unless `kickSkill` says so; every other racer is held still where it starts.
 */
function tessOn(ascii: string, at: { x: number; y: number }, profile: { kickSkill?: number; wobble?: number } = {}) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(courseFromLevel(ascii, 'drift'), log, { seed: 1, endsWhen: 'everyone' });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  const tess = racerOf(world, 'tess');
  tess.profile = { ...tess.profile, kickSkill: 0, wobble: 0, reactionTicks: 1, ...profile };
  for (const racer of world.racers) if (racer !== tess) racer.status.trapped = 100_000;
  placeOnTile(tess, at.x, at.y);
  return { world, log, tess };
}

describe('the drift pilot', () => {
  it.each([
    ['never dashing', 0],
    ['dashing whenever it may', 1],
  ])('slows before the wall at the end of a straight and turns up the shaft, %s', (_name, kickSkill) => {
    const { world, log, tess } = tessOn(STRAIGHT_THEN_UP, { x: 6, y: 6 }, { kickSkill });
    const wallX = END_WALL_COL * TILE;
    const tooFast: string[] = [];
    let topSpeed = 0;
    let ticks = 0;
    for (; ticks < 900 && tess.body.y > 2 * TILE; ticks++) {
      step(world, log, 1, IDLE);
      const gap = Math.max(0, wallX - (tess.body.x + tess.body.w));
      const canShed = Math.sqrt(2 * force * gap) * 1.15 + 10;
      topSpeed = Math.max(topSpeed, tess.body.vx);
      if (tess.body.vx > canShed)
        tooFast.push(`tick ${ticks}: vx ${Math.round(tess.body.vx)} with ${Math.round(gap)} px left`);
    }

    expect(tooFast).toEqual([]);
    expect(topSpeed).toBeGreaterThan(cruise * 0.9);
    expect(ticks).toBeLessThan(900);
  });

  it('straightens out within a second of being knocked sideways', () => {
    const { world, log, tess } = tessOn(OPEN, { x: 10, y: 5 });
    tess.body.vx = 80;
    tess.body.vy = 80;
    step(world, log, 60, IDLE);

    expect(tess.body.vx).toBeGreaterThan(0);
    expect(Math.abs(tess.body.vy)).toBeLessThan(tess.body.vx * 0.577);
  });

  it('keeps speed it was given over cruise while the way ahead is open, instead of braking back to cruise', () => {
    const { world, log, tess } = tessOn(OPEN, { x: 6, y: 5 });
    tess.body.vx = maxSpeed - 10;
    step(world, log, 30, IDLE);

    expect(tess.body.vx).toBeGreaterThan(cruise + 20);
  });

  it('dashes down a long open straight and holds the dash with the turn close ahead', () => {
    const kicksIn10Calls = (tx: number) => {
      const { world, tess } = tessOn(STRAIGHT_THEN_UP, { x: tx, y: 6 }, { kickSkill: 1 });
      tess.body.vx = cruise;
      const mods = effectiveTuning(world).base;
      return Array.from({ length: 10 }, () => DRIFT_MEDIUM.steer(world, tess, mods, KEEN, false).kick).filter(Boolean)
        .length;
    };

    expect(kicksIn10Calls(8)).toBeGreaterThan(0);
    expect(kicksIn10Calls(32)).toBe(0);
  });

  it('goes round a racer parked in its way without losing much time', () => {
    const ticksToCol40 = (parkedRow: number) => {
      const { world, log, tess } = tessOn(OPEN, { x: 10, y: 5 });
      placeOnTile(racerOf(world, 'player'), 22, parkedRow);
      let ticks = 0;
      for (; ticks < 900 && tess.body.x < 40 * TILE; ticks++) step(world, log, 1, IDLE);
      return ticks;
    };
    const clear = ticksToCol40(1);
    const blocked = ticksToCol40(5);

    expect(clear).toBeLessThan(900);
    expect(blocked).toBeLessThanOrEqual(clear * 1.25);
  });

  it('takes a different path when only its wobble differs', () => {
    const path = (wobble: number) => {
      const { world, log, tess } = tessOn(OPEN, { x: 6, y: 5 }, { wobble });
      return Array.from({ length: 30 }, () => {
        step(world, log, 10, IDLE);
        return `${Math.round(tess.body.x)},${Math.round(tess.body.y)}`;
      });
    };

    expect(path(0.5)).not.toEqual(path(0));
  });

  it('turns up a shaft later the longer its reactionTicks', () => {
    const callsUntilTurnUp = (reaction: number) => {
      const { world, tess } = tessOn(CORNER_UP, { x: 3, y: 5 });
      tess.profile = { ...tess.profile, reactionTicks: reaction };
      const mods = effectiveTuning(world).base;
      if (DRIFT_MEDIUM.steer(world, tess, mods, STEADY, false).aim.y < -0.5) {
        throw new Error('Tess aimed up the shaft before reaching it');
      }
      placeOnTile(tess, 6, 5);
      for (let calls = 1; calls <= 120; calls++) {
        if (DRIFT_MEDIUM.steer(world, tess, mods, STEADY, false).aim.y < -0.5) return calls;
      }
      throw new Error(`Tess never aimed up the shaft in 120 calls with reactionTicks ${reaction}`);
    };
    const quick = callsUntilTurnUp(1);
    const slow = callsUntilTurnUp(30);

    expect(quick).toBeLessThanOrEqual(2);
    expect(slow).toBeGreaterThan(quick + 20);
  });
});
