import { EventLog, TICK_DT } from '@arcade/core';
import { expect, it } from 'vitest';
import { surfaceAt, validateCourse } from '../course.ts';
import type { GameEvent } from '../events.ts';
import { NO_INPUT } from '../racer.ts';
import { DASH, RACE, RUN } from '../tuning.ts';
import { createWorld, playerOf, stepWorld } from '../world.ts';
import { THORNWOOD_TRAIL } from './thornwood-trail.ts';

it('keeps Thornwood Trail within the course rules', () => {
  expect(validateCourse(THORNWOOD_TRAIL)).toEqual([]);
});

function runTrail(dash: boolean) {
  const course = THORNWOOD_TRAIL;
  const events = new EventLog<GameEvent>();
  const world = createWorld(events, { course, seed: 4, character: 'grit', rivals: false });
  const racer = playerOf(world);
  let previousJump = -1;
  let firstMudS: number | null = null;
  while (world.phase !== 'finished') {
    const { s, d, vd, vs } = racer;
    if (firstMudS === null && surfaceAt(course, s, d).kind === 'mud') firstMudS = s;
    let lane = 0;
    let push = 0;
    for (const feature of course.features) {
      if (feature.kind === 'mud' && s + 20 >= feature.s0 && s < feature.s1) {
        if (feature.d0 <= 0 && feature.d1 >= 0) lane = feature.d0 === -course.halfWidth ? 3.5 : -3.5;
      }
      if (feature.kind === 'gust' && s >= feature.s0 && s < feature.s1) push += feature.push;
    }
    const dashPressed = dash && (racer.dashCharges > 0 || racer.dashRecharge === 1);
    const speed = dashPressed ? Math.max(vs, DASH.speed) : vs;
    let jumpPressed = false;
    for (const feature of course.features) {
      if (feature.kind !== 'log' && feature.kind !== 'pit') continue;
      const edge = feature.kind === 'log' ? feature.s : feature.s0;
      if (feature.kind === 'pit' && (lane <= feature.d0 || lane >= feature.d1)) continue;
      if (edge > s && edge <= s + speed * 0.25 && edge !== previousJump) {
        jumpPressed = true;
        previousJump = edge;
        break;
      }
    }
    events.tick = world.tick;
    stepWorld(
      world,
      {
        player: {
          ...NO_INPUT,
          forward: true,
          steer: (lane - d) * 2 - vd / 12 - push / RUN.steerSpeed,
          jumpPressed,
          jumpHeld: jumpPressed || !racer.grounded,
          dashPressed,
        },
      },
      TICK_DT,
    );
  }
  return { events: events.all(), finishTicks: racer.finishTicks ?? RACE.limitTicks, firstMudS };
}

it('runs Thornwood Trail cleanly at par and finishes faster with a dash on each charge', () => {
  const clean = runTrail(false);
  expect(clean.firstMudS).toBeNull();
  expect(clean.events.filter((event) => event.type === 'racer.fell' || event.type === 'racer.bumped')).toEqual([]);
  expect(clean.events.at(-2)).toMatchObject({ type: 'racer.finished', ticks: clean.finishTicks });
  expect(THORNWOOD_TRAIL.parTicks).toBe(Math.ceil(clean.finishTicks / 100) * 100);
  expect(THORNWOOD_TRAIL.parTicks / 60).toBeGreaterThanOrEqual(75);
  expect(THORNWOOD_TRAIL.parTicks / 60).toBeLessThanOrEqual(100);
  const dashed = runTrail(true);
  expect(dashed.events.at(-2)).toMatchObject({ type: 'racer.finished', ticks: dashed.finishTicks });
  expect(dashed.finishTicks).toBeLessThan(clean.finishTicks);
});
