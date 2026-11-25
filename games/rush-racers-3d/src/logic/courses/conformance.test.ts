import { EventLog, TICK_DT } from '@arcade/core';
import { expect, it } from 'vitest';
import { assertCourse } from '../course.ts';
import type { GameEvent } from '../events.ts';
import { RACE } from '../tuning.ts';
import { createWorld, stepWorld } from '../world.ts';
import { COURSES } from './index.ts';

it.each(COURSES)('$id passes course validation', (course) => {
  expect(() => assertCourse(course)).not.toThrow();
});

it.each(COURSES)('$id lets all rivals finish within 125% of par and two falls', (course) => {
  const deadline = Math.floor(course.parTicks * 1.25);
  const hasCrates = course.features.some((feature) => feature.kind === 'crate');
  for (const seed of [1, 2, 3, 4, 5]) {
    const events = new EventLog<GameEvent>(8192);
    const world = createWorld(events, { course, seed, character: 'grit', rivals: true });
    expect(world.racers.length).toBeGreaterThan(1);
    for (let tick = 0; tick < RACE.countdownTicks + deadline && world.phase !== 'finished'; tick++) {
      events.tick = world.tick;
      stepWorld(world, {}, TICK_DT);
    }
    const raceEvents = events.all();
    const fallEvents = raceEvents.filter((event) => event.type === 'racer.fell');
    for (const { id, finishTicks } of world.racers.slice(1)) {
      const falls = fallEvents.filter((fall) => fall.id === id);
      expect(finishTicks, `seed ${seed}: ${id} finish`).not.toBeNull();
      expect(finishTicks, `seed ${seed}: ${id} finish`).toBeLessThanOrEqual(deadline);
      expect(falls.length, `seed ${seed}: ${id} falls at ${falls.map(({ s }) => s).join(', ')}`).toBeLessThanOrEqual(2);
    }
    if (hasCrates) {
      expect(
        raceEvents.some((event) => event.type === 'crate.opened'),
        `seed ${seed}: crate opened`,
      ).toBe(true);
      expect(
        raceEvents.some((event) => event.type === 'item.fired'),
        `seed ${seed}: item fired`,
      ).toBe(true);
    }
  }
});
