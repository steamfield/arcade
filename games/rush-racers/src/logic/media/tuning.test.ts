/**
 * A course's tuning overrides reach the race: `effectiveTuning` lays them over the medium's tuning
 * (`extra` key by key), then the medium's own `byDifficulty` multipliers for the world's difficulty,
 * and the medium moves racers (and builds its nav) by the result.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { GLIDE_MEDIUM } from '../conformance/glide.ts';
import { COURSES } from '../courses/index.ts';
import type { Course } from '../courses/types.ts';
import type { GameEvent } from '../events.ts';
import { length } from '../num.ts';
import { courseFromLevel, hold, placeOnTile, racerOf } from '../test-world.ts';
import { DIFFICULTIES, type Difficulty } from '../types.ts';
import { createWorld, stepWorld } from '../world.ts';
import { mediumIdOf } from '../worlds/index.ts';
import { FLIGHT_TUNING } from './flight/tuning.ts';
import { effectiveTuning, MEDIA, registerMedium } from './index.ts';
import type { Medium, MediumTuning } from './types.ts';

const POOL = `
  ##############################
  #1..........................F#
  #2..........................F#
  #3..........................F#
  #4..........................F#
  ##############################
`;

/** A racing swim world on a course with `tuning` overrides. */
function swimWith(tuning: NonNullable<Course['tuning']>) {
  const course = courseFromLevel(POOL, 'swim', { tuning });
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

  it('rejects an extra the medium does not have when the race is set up, naming the course, the key and the valid extras', () => {
    const course = courseFromLevel(POOL, 'swim', { tuning: { extra: { kelpDrag: 0.5 } } });

    expect(() => createWorld(course, new EventLog<GameEvent>(100), { seed: 1 })).toThrow(
      `Course '${course.id}' tunes unknown extra 'kelpDrag' for medium 'swim' (valid extras: ${Object.keys(MEDIA.swim.tuning.extra).join(', ')})`,
    );
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

/** A world on POOL in `medium` at `difficulty`. */
function poolWorld(medium: string, difficulty: Difficulty) {
  return createWorld(courseFromLevel(POOL, medium), new EventLog<GameEvent>(1000), { seed: 1, difficulty });
}

/** Glide under another id with `byDifficulty` multipliers, recording the tuning its nav was built with. */
function glideScaledBy(id: string, byDifficulty: MediumTuning['byDifficulty']) {
  const navTunings: MediumTuning[] = [];
  const medium: Medium = {
    ...GLIDE_MEDIUM,
    id,
    tuning: { ...GLIDE_MEDIUM.tuning, byDifficulty },
    buildNav: (level, broken, tuning) => {
      navTunings.push(tuning);
      return GLIDE_MEDIUM.buildNav(level, broken, tuning);
    },
  };
  registerMedium(medium);
  return { medium, navTunings };
}

describe('difficulty tuning', () => {
  const { byDifficulty: _scales, ...flightBase } = FLIGHT_TUNING;

  it("gives a flight race on Easy flight's gravity x0.75 and flap lift x1.15, everything else as is", () => {
    expect(effectiveTuning(poolWorld('flight', 'easy'))).toEqual({
      ...flightBase,
      extra: {
        ...FLIGHT_TUNING.extra,
        gravity: FLIGHT_TUNING.extra.gravity * 0.75,
        flapLift: FLIGHT_TUNING.extra.flapLift * 1.15,
      },
    });
  });

  it.each(['normal', 'hard'] as const)('gives a flight race on %s the base numbers', (difficulty) => {
    expect(effectiveTuning(poolWorld('flight', difficulty))).toEqual(flightBase);
  });

  it('leaves every shipped swim and run course the same on every difficulty', () => {
    const media = Object.values(COURSES).map((course) => ({ course: course.id, medium: mediumIdOf(course) }));
    const swimAndRun = media.filter(({ medium }) => medium === 'swim' || medium === 'run');
    const byLevel = swimAndRun.map((race) =>
      DIFFICULTIES.map((difficulty) => effectiveTuning({ ...race, difficulty })),
    );

    expect(swimAndRun.map(({ medium }) => medium)).toEqual(expect.arrayContaining(['swim', 'run']));
    for (const [easy, normal, hard] of byLevel) {
      expect(easy).toEqual(hard);
      expect(normal).toEqual(hard);
    }
  });

  it('keeps two worlds on one course apart when their difficulties differ', () => {
    const course = courseFromLevel(POOL, 'flight');
    const at = (difficulty: Difficulty) => createWorld(course, new EventLog<GameEvent>(1000), { seed: 1, difficulty });
    const hard = effectiveTuning(at('hard')).extra.gravity;
    const easy = effectiveTuning(at('easy')).extra.gravity;

    expect([hard, easy, effectiveTuning(at('hard')).extra.gravity]).toEqual([
      FLIGHT_TUNING.extra.gravity,
      FLIGHT_TUNING.extra.gravity * 0.75,
      FLIGHT_TUNING.extra.gravity,
    ]);
  });

  it("builds the nav at createWorld on Easy with Easy's tuning", () => {
    const { navTunings } = glideScaledBy('glide-easy-gravity', { easy: { gravity: 2 } });
    poolWorld('glide-easy-gravity', 'easy');

    expect(navTunings.map((tuning) => tuning.extra.gravity)).toEqual([
      (GLIDE_MEDIUM.tuning.extra.gravity ?? Number.NaN) * 2,
    ]);
  });

  it('rejects a multiplier for an extra the medium does not have, naming the medium, difficulty and key', () => {
    glideScaledBy('glide-bad-scale', { easy: { lift: 2 } });

    expect(() => poolWorld('glide-bad-scale', 'easy')).toThrow(
      "Medium 'glide-bad-scale' scales unknown extra 'lift' on difficulty 'easy'",
    );
  });
});
