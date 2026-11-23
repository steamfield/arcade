/**
 * Flight's rival pilot: the profile's `wobble` changes the path it flies, `reactionTicks` changes
 * how late it turns, every flap is a real press (Up let go between flaps), it glides down to a
 * target a little below after a flap, and it dashes through a puff cloud only sideways and keeps at
 * it until the cloud pops. Raced through
 * `createWorld` on sky-test and small inline courses, or steered one call at a time through
 * `FLIGHT_MEDIUM.steer` where the test needs to count ticks of its reaction.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { courseById } from '../../courses/index.ts';
import type { Course } from '../../courses/types.ts';
import type { GameEvent } from '../../events.ts';
import { courseFromLevel, IDLE, placeOnTile, racerOf, step } from '../../test-world.ts';
import { type Racer, type RacerId, TILE, type World } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { effectiveTuning } from '../index.ts';
import type { AiDraws } from '../types.ts';
import { flightMotion } from './data.ts';
import { FLIGHT_MEDIUM } from './index.ts';

function skyTest(): Course {
  const course = courseById('sky-test');
  if (!course) throw new Error("No course 'sky-test'");
  return course;
}

/** A racing world on `course` (seed 1) with the player idle at the start. */
function racing(course: Course): { world: World; log: EventLog<GameEvent> } {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(course, log, { seed: 1, endsWhen: 'everyone' });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  return { world, log };
}

/** Tess's tile every 10 ticks for 6 s of sky-test with her wobble set to `wobble`. */
function tessPath(wobble: number): string[] {
  const { world, log } = racing(skyTest());
  const tess = racerOf(world, 'tess');
  tess.profile = { ...tess.profile, wobble };
  return Array.from({ length: 36 }, () => {
    step(world, log, 10, IDLE);
    return `${Math.floor(tess.body.x / TILE)},${Math.floor(tess.body.y / TILE)}`;
  });
}

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

/** Draws that never dash and put no jitter on the target. */
const STEADY: AiDraws = { wobble: 0.5, kick: 1, side: 0, item: 1 };

/**
 * Steers tess once at (3,5) along the bottom, puts her under the shaft 3 tiles on, and counts the
 * steer calls until her aim turns up the shaft, with `reactionTicks` set to `reaction`.
 */
function callsUntilTurnUp(reaction: number): number {
  const world = createWorld(courseFromLevel(CORNER_UP, 'flight'), new EventLog<GameEvent>(1000), { seed: 1 });
  const tess = racerOf(world, 'tess');
  tess.profile = { ...tess.profile, reactionTicks: reaction, wobble: 0 };
  const mods = effectiveTuning(world).base;
  placeOnTile(tess, 3, 5);
  const before = FLIGHT_MEDIUM.steer(world, tess, mods, STEADY, false);
  if (before.aim.y < -0.5) throw new Error('Tess aimed up the shaft before reaching it');
  placeOnTile(tess, 6, 5);
  for (let calls = 1; calls <= 120; calls++) {
    if (FLIGHT_MEDIUM.steer(world, tess, mods, STEADY, false).aim.y < -0.5) return calls;
  }
  throw new Error(`Tess never aimed up the shaft in 120 calls with reactionTicks ${reaction}`);
}

/** A tunnel along row 4 plugged by a puff cloud at col 10, beside a long way back, up and over. */
const PLUGGED_TUNNEL = `
  ####################
  #..................#
  #.################.#
  #.################.#
  #1234.....C.......F#
  ####################
`;

/** A one-wide shaft at col 12 plugged by a puff cloud at row 4, beside a long way round to the left and over the top. */
const PLUGGED_SHAFT = `
  ################
  #.............F#
  #.##########.###
  #.##########.###
  #.##########C###
  #.##########.###
  #.##########.###
  #.##########.###
  #1.2.3.4.....###
  ################
`;

/** Open sky whose only finish tile is at row 2, so the way from below or above levels out along row 2. */
const LEVEL_OFF = `
  ############
  #.........##
  #.........F#
  #.........##
  #1234.....##
  ############
`;

/** A racing world on an inline flight level with tess, who always dashes and never wobbles, put on tile `at`. */
function tessOn(ascii: string, at: { x: number; y: number }) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(courseFromLevel(ascii, 'flight'), log, { seed: 1, endsWhen: 'everyone' });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  const tess = racerOf(world, 'tess');
  tess.profile = { ...tess.profile, kickSkill: 1, wobble: 0, reactionTicks: 1 };
  placeOnTile(tess, at.x, at.y);
  return { world, log, tess };
}

/** Whether `racer` emitted `racer.flapped` among `events`. */
const flappedIn = (events: readonly GameEvent[], racer: Racer) =>
  events.some((event) => event.type === 'racer.flapped' && event.id === racer.id);

describe('the flight pilot', () => {
  it('takes a different path on seed 1 when only its wobble differs', () => {
    expect(tessPath(0.5)).not.toEqual(tessPath(0));
  });

  it('turns up a shaft later the longer its reactionTicks', () => {
    const quick = callsUntilTurnUp(1);
    const slow = callsUntilTurnUp(30);

    expect(quick).toBeLessThanOrEqual(2);
    expect(slow).toBeGreaterThan(quick + 20);
  });

  it('lets go of Up between flaps: every flap is a fresh press, and the rivals flap to climb sky-test', () => {
    const { world, log } = racing(skyTest());
    const rivals = (['tess', 'squib', 'bo'] as const satisfies readonly RacerId[]).map((id) => racerOf(world, id));
    const heldBefore = new Map(rivals.map((rival) => [rival.id, false]));
    const heldFlaps: string[] = [];
    let flaps = 0;
    for (let tick = 0; tick < 600; tick++) {
      const seen = log.all().length;
      step(world, log, 1, IDLE);
      const events = log.all().slice(seen);
      for (const rival of rivals) {
        if (flappedIn(events, rival)) {
          flaps++;
          if (heldBefore.get(rival.id)) heldFlaps.push(`${rival.id} at tick ${world.tick}`);
        }
        heldBefore.set(rival.id, flightMotion(rival.motion).upWasHeld);
      }
    }

    expect(heldFlaps).toEqual([]);
    expect(flaps).toBeGreaterThanOrEqual(3 * rivals.length);
  });

  it('dashes at a puff cloud plugging a shorter tunnel and keeps facing ahead until it is through', () => {
    const { world, log, tess } = tessOn(PLUGGED_TUNNEL, { x: 6, y: 4 });
    const facingSinceDash: number[] = [];
    let dashed = false;
    let poppedBy: string | null = null;
    const throughAt = 13 * TILE;
    for (let tick = 0; tick < 240 && tess.body.x < throughAt; tick++) {
      const seen = log.all().length;
      step(world, log, 1, IDLE);
      for (const event of log.all().slice(seen)) {
        if (event.type === 'racer.kicked' && event.id === 'tess') dashed = true;
        if (event.type === 'coral.broken') poppedBy ??= event.by;
      }
      if (dashed) facingSinceDash.push(tess.facing);
    }

    expect(poppedBy).toBe('tess');
    expect(tess.body.x).toBeGreaterThanOrEqual(throughAt);
    expect(facingSinceDash.filter((facing) => facing !== 1)).toEqual([]);
  });

  it('never flies up a shaft to dash at a puff cloud plugging it, since a dash only goes sideways', () => {
    const { world, log, tess } = tessOn(PLUGGED_SHAFT, { x: 10, y: 8 });
    const inShaft: string[] = [];
    for (let tick = 0; tick < 300; tick++) {
      step(world, log, 1, IDLE);
      const tile = {
        x: Math.floor((tess.body.x + tess.body.w / 2) / TILE),
        y: Math.floor((tess.body.y + tess.body.h / 2) / TILE),
      };
      if (tile.x === 12 && tile.y < 8) inShaft.push(`${tile.x},${tile.y} at tick ${world.tick}`);
    }

    expect(inShaft).toEqual([]);
  });

  it('keeps holding Up after a flap to glide down to a target a tile below', () => {
    const { world, tess } = tessOn(LEVEL_OFF, { x: 6, y: 3 });
    const mods = effectiveTuning(world).base;
    const flap = FLIGHT_MEDIUM.steer(world, tess, mods, STEADY, false);
    placeOnTile(tess, 6, 1);
    const glide = FLIGHT_MEDIUM.steer(world, tess, mods, STEADY, false);

    expect([flap.move.y, glide.move.y]).toEqual([-1, -1]);
  });
});
