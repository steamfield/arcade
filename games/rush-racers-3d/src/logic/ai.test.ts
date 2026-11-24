import { EventLog, TICK_DT } from '@arcade/core';
import { expect, it } from 'vitest';
import { THORNWOOD_TRAIL } from './courses/thornwood-trail.ts';
import type { GameEvent } from './events.ts';
import { NO_INPUT } from './racer.ts';
import { RACE, RIVAL, RUN } from './tuning.ts';
import type { Course, Feature, TickInputs } from './types.ts';
import { createWorld, stepWorld } from './world.ts';

const straight: Course = {
  id: 'straight',
  name: 'Straight',
  path: [{ kind: 'straight', length: 260 }],
  halfWidth: 5,
  hills: [],
  startS: 0,
  finishS: 260,
  parTicks: 1200,
  features: [],
};

function start(course: Course, seed = 4) {
  const events = new EventLog<GameEvent>(8192);
  const world = createWorld(events, { course, seed, character: 'grit', rivals: true });
  const [player, rival] = world.racers;
  if (!player || !rival) throw new Error('expected the player and a rival');
  function step(inputs: TickInputs = {}) {
    events.tick = world.tick;
    stepWorld(world, inputs, TICK_DT);
  }
  for (let i = 0; i < RACE.countdownTicks; i++) step();
  return { world, events, player, rival, step };
}

it.each(['r1', 'r2', 'r3'] as const)('ignores caller input for %s while the rival runs on its own', (id) => {
  const { world, step } = start(straight);
  const clean = start(straight);
  for (let tick = 0; tick < 90; tick++) {
    step({ [id]: { ...NO_INPUT, brake: true, steer: -1, jumpPressed: true, dashPressed: true } });
    clean.step();
  }
  expect(world.racers.find((racer) => racer.id === id)?.s).toBeGreaterThan(10);
  expect(world.racers).toEqual(clean.world.racers);
  expect(world.rngState).toBe(clean.world.rngState);
});

it('keeps all three rivals on the track against a crosswind stronger than steering', () => {
  const course: Course = {
    ...straight,
    features: [{ kind: 'gust', s0: 0, s1: 50, d0: -5, d1: 5, push: 15 }],
  };
  const { world, step } = start(course);
  for (const [index, racer] of world.racers.slice(1).entries()) racer.s = 10 + 7 * index;
  const edge = course.halfWidth - RUN.radius;
  const reachedEdge = new Set();
  for (let tick = 0; tick < 100; tick++) {
    step();
    for (const { id, d } of world.racers.slice(1)) {
      expect(Math.abs(d)).toBeLessThanOrEqual(edge);
      if (d === edge) reachedEdge.add(id);
    }
  }
  expect(reachedEdge).toEqual(new Set(['r1', 'r2', 'r3']));
});

it('breaks up the pack when rivals first dash on an open straight', () => {
  const { events, step } = start(straight);
  for (let tick = 0; tick < 55; tick++) step();
  const dashes = events.all().filter((event) => event.type === 'racer.dashed');
  expect(dashes.map(({ id }) => id).sort()).toEqual(['r1', 'r2', 'r3']);
  expect(new Set(dashes.map(({ tick }) => tick)).size).toBeGreaterThan(1);
});

it('finds room to pass a half-width log without staying in contact for half a second', () => {
  const course = { ...straight, features: [{ kind: 'log' as const, s: 100, d0: 0, d1: 5, height: 1.2 }] };
  const { world, step, events } = start(course, 1);
  for (let tick = 0; tick < 400; tick++) step();
  expect(world.racers.slice(1).every(({ s }) => s > 105)).toBe(true);
  const contacts = events
    .all()
    .filter((event) => event.type === 'racer.bumped' && event.id === 'r1' && event.by === 'r3');
  let streak = 0;
  let last = -2;
  for (const { tick } of contacts) {
    streak = tick === last + 1 ? streak + 1 : 1;
    expect(streak).toBeLessThan(30);
    last = tick;
  }
});

const hazards = [
  { kind: 'log', s: 40, d0: -5, d1: 5, height: 1.2 },
  { kind: 'pit', s0: 40, s1: 47, d0: -5, d1: 5 },
  { kind: 'pit', s0: 40, s1: 60, d0: 0, d1: 5 },
  { kind: 'mud', s0: 40, s1: 60, d0: 0, d1: 5 },
] satisfies Feature[];

it.each(hazards)('clears $kind across d = $d0 to $d1 and stays on the track', (feature) => {
  const course = { ...straight, features: [feature] };
  const { rival, step, events } = start(course);
  for (let tick = 1; tick <= 330; tick++) {
    step();
    expect(Math.abs(rival.d)).toBeLessThanOrEqual(course.halfWidth - RUN.radius);
    if (feature.kind !== 'log' && feature.d0 === 0 && rival.s >= feature.s0 && rival.s < feature.s1) {
      expect(rival.d).toBeLessThan(0);
      expect(rival.vs).toBeGreaterThan(RUN.runSpeed * RUN.mudSpeedMul);
    }
  }
  expect(rival.s).toBeGreaterThan(66);
  const hazardEvents = events
    .all()
    .filter(
      (event) =>
        'id' in event &&
        event.id === rival.id &&
        (event.type === 'racer.fell' ||
          event.type === 'racer.jumped' ||
          (event.type === 'racer.bumped' && event.by === null)),
    );
  expect(hazardEvents.map(({ type }) => type)).toEqual(feature.d0 < 0 ? ['racer.jumped'] : []);
  if (feature.d0 < 0) expect(hazardEvents[0]?.tick).toBeLessThan(RACE.countdownTicks + 240);
});

it.each(['clear', 'pit', 'log', 'empty-meter'] as const)('dashes only with charge and clearance: %s', (kind) => {
  const endOfClearance = 50 + RIVAL.dashClearance;
  const features: Feature[] =
    kind === 'log'
      ? [{ kind, s: endOfClearance, d0: -5, d1: 5, height: 1 }]
      : kind === 'pit'
        ? [{ kind, s0: endOfClearance, s1: endOfClearance + 5, d0: -5, d1: 5 }]
        : [];
  const { rival, step, events } = start({ ...straight, features });
  rival.s = 50;
  rival.vs = RUN.runSpeed;
  rival.dashCharges = kind === 'empty-meter' ? 0 : 1;
  if (kind === 'empty-meter') rival.dashRecharge = 1;
  step();
  expect(events.all().filter((event) => event.type === 'racer.dashed' && event.id === rival.id)).toMatchObject(
    kind === 'clear' ? [{ type: 'racer.dashed', tick: RACE.countdownTicks, id: rival.id, charges: 0 }] : [],
  );
  if (kind === 'empty-meter') {
    expect(rival.dashCharges).toBe(1);
    step();
    expect(events.all().filter((event) => event.type === 'racer.dashed' && event.id === rival.id)).toMatchObject([
      { type: 'racer.dashed', tick: RACE.countdownTicks + 1, charges: 0 },
    ]);
  }
});

it.each([-2, -1, -0.5, 0, 0.5, 1, 2])('scales only rival running speed for a player gap of %sx range', (gap) => {
  const course = { ...straight, path: [{ kind: 'straight' as const, length: 600 }], finishS: 600 };
  const { player, rival, step } = start(course);
  player.s = 260 + gap * RIVAL.catchUpRange;
  player.vs = RUN.runSpeed;
  rival.s = 260;
  rival.vs = RUN.runSpeed * (1 - RIVAL.catchUp) - 0.1;
  rival.dashCharges = 0;
  // Start an equal distance apart each tick to measure the steady-state cap for this gap.
  for (let i = 0; i < 16; i++) {
    player.s = 260 + gap * RIVAL.catchUpRange;
    rival.s = 260;
    step({ player: { ...NO_INPUT, forward: true } });
  }
  expect(player.vs).toBe(RUN.runSpeed);
  expect(rival.vs).toBeCloseTo(RUN.runSpeed * (1 + Math.max(-1, Math.min(1, gap)) * RIVAL.catchUp), 8);
});

it.each([1, 2, 3, 4, 5])('finishes Thornwood Trail with all rivals within par and two falls, seed %i', (seed) => {
  const deadline = Math.floor(THORNWOOD_TRAIL.parTicks * 1.25);
  const { world, events, step } = start(THORNWOOD_TRAIL, seed);
  for (let tick = 0; tick < deadline && world.phase !== 'finished'; tick++) step();
  for (const { id, finishTicks } of world.racers.slice(1)) {
    const falls = events.all().filter((event) => event.type === 'racer.fell' && event.id === id);
    expect(finishTicks, `${id} finish`).not.toBeNull();
    expect(finishTicks, `${id} finish`).toBeLessThanOrEqual(deadline);
    expect(falls.length, `${id} falls at ${falls.map((fall) => 's' in fall && fall.s).join(', ')}`).toBeLessThanOrEqual(
      2,
    );
  }
});
