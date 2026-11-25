import { EventLog, TICK_DT } from '@arcade/core';
import { expect, it } from 'vitest';
import type { GameEvent } from './events.ts';
import { NO_INPUT } from './racer.ts';
import { ITEMS, RACE, RUN } from './tuning.ts';
import type { Course } from './types.ts';
import { createWorld, stepWorld } from './world.ts';

const course: Course = {
  id: 'straight',
  name: 'Straight',
  path: [{ kind: 'straight', length: 200 }],
  halfWidth: 5,
  hills: [],
  startS: 0,
  finishS: 200,
  theme: 'forest',
  parTicks: 900,
  features: [],
};

function start(layout = course) {
  const events = new EventLog<GameEvent>();
  const world = createWorld(events, { course: layout, seed: 4, character: 'grit', rivals: true });
  const [player, r1, r2, r3] = world.racers;
  if (!player || !r1 || !r2 || !r3) throw new Error('expected four racers');
  for (let i = 0; i < RACE.countdownTicks; i++) stepWorld(world, {}, TICK_DT);
  r2.s = 80;
  r3.s = 100;
  player.s = r1.s = 50;
  return { world, events, player, r1, r2, r3 };
}

it('separates a moving pair on the contact tick and transfers some sideways momentum', () => {
  const { world, events, player, r1 } = start();
  Object.assign(player, { d: 0.25, vd: 5, vs: RUN.runSpeed });
  Object.assign(r1, { d: 1.25, vd: 0, vs: RUN.runSpeed, dashCharges: 0 });
  stepWorld(world, { player: { ...NO_INPUT, forward: true, steer: 1 } }, TICK_DT);
  expect(r1.d - player.d).toBeCloseTo(2 * RUN.radius, 6);
  expect(player.vd).toBeGreaterThan(0);
  expect(player.vd).toBeLessThan(5);
  expect(r1.vd).toBeGreaterThan(0);
  expect(player.vs).toBe(RUN.runSpeed);
  expect(events.all().filter((event) => event.type === 'racer.bumped')).toMatchObject([
    { type: 'racer.bumped', id: 'player', by: 'r1', s: player.s },
    { type: 'racer.bumped', id: 'r1', by: 'player', s: r1.s },
  ]);
  for (let i = 0; i < 8; i++) {
    stepWorld(world, { player: { ...NO_INPUT, forward: true, steer: 1 } }, TICK_DT);
    expect(r1.d - player.d).toBeGreaterThanOrEqual(2 * RUN.radius - 0.000001);
  }
});

it('uses the free side to separate racers against a track edge', () => {
  const { world, player, r1 } = start();
  const edge = course.halfWidth - RUN.radius;
  player.d = edge - 0.1;
  r1.d = edge;
  stepWorld(world, {}, TICK_DT);
  expect(r1.d).toBeCloseTo(edge, 2);
  expect(r1.d - player.d).toBeCloseTo(2 * RUN.radius, 6);
});

it('keeps the pre-tick side order when overlapping racers try to cross', () => {
  const { world, player, r1 } = start();
  Object.assign(player, { d: 0, vd: RUN.steerSpeed });
  Object.assign(r1, { d: 0.05, vd: -RUN.steerSpeed });
  stepWorld(world, { player: { ...NO_INPUT, steer: 1 } }, TICK_DT);
  expect(r1.d - player.d).toBeCloseTo(2 * RUN.radius, 6);
});

it('separates a three-racer squeeze and emits each pair contact once', () => {
  const { world, events, player, r1, r2 } = start();
  r2.s = player.s;
  player.d = -0.7;
  r1.d = 0.1;
  r2.d = 0.9;
  stepWorld(world, {}, TICK_DT);
  expect(r1.d - player.d).toBeCloseTo(2 * RUN.radius, 6);
  expect(r2.d - r1.d).toBeCloseTo(2 * RUN.radius, 6);
  expect(
    events
      .all()
      .filter((event) => event.type === 'racer.bumped')
      .map(({ id, by }) => [id, by]),
  ).toEqual([
    ['player', 'r1'],
    ['r1', 'player'],
    ['r1', 'r2'],
    ['r2', 'r1'],
  ]);
});

it('applies a burr hit after its bump pair and locks the stunned racer for the next pair', () => {
  const { world, events, player, r1, r2 } = start();
  r2.s = player.s;
  r1.d = -0.75;
  player.d = 0;
  r2.d = 0.75;
  r1.items.burrTicks = 2;
  r1.items.trappedTicks = 2;

  stepWorld(world, {}, TICK_DT);

  // The trapped rival stays at -0.75. Its push to 0.25 is the player's last move this tick.
  expect(player.d).toBe(0.25);
  expect(player.vd).toBe(0);
  expect(player.items.stunTicks).toBe(ITEMS.stunTicks);
  expect(r2.d).toBe(1.25);
  expect(events.all().filter((event) => event.type === 'racer.bumped' || event.type === 'racer.hit')).toMatchObject([
    { type: 'racer.bumped', id: 'player', by: 'r1' },
    { type: 'racer.bumped', id: 'r1', by: 'player' },
    { type: 'racer.hit', id: 'player', by: 'r1', kind: 'burr', outcome: 'stunned' },
    { type: 'racer.bumped', id: 'player', by: 'r2' },
    { type: 'racer.bumped', id: 'r2', by: 'player' },
  ]);
});

it('separates a pair alongside a log without shoving through its side', () => {
  const layout: Course = { ...course, features: [{ kind: 'log', s: 50, d0: 0, d1: 5, height: 1 }] };
  const { world, player, r1 } = start(layout);
  player.s = r1.s = 50.5;
  player.d = -0.05;
  r1.d = -0.5;
  stepWorld(world, {}, TICK_DT);
  expect(player.d).toBeLessThan(0);
  expect(player.d - r1.d).toBeCloseTo(2 * RUN.radius, 6);
  expect(player.grounded).toBe(true);
});

const pitCourse: Course = { ...course, features: [{ kind: 'pit', s0: 40, s1: 65, d0: 0, d1: 5 }] };

it('updates support and starts coyote time on the tick a racer is pushed off a pit lip', () => {
  const { world, player, r1 } = start(pitCourse);
  player.d = -0.05;
  r1.d = -0.5;
  stepWorld(world, {}, TICK_DT);
  expect(player.d).toBeGreaterThan(0);
  expect(player).toMatchObject({ grounded: false, coyoteTicks: RUN.coyoteTicks });
  expect(player.safeD).toBeLessThan(0);
});

it('keeps a falling racer inside the pit wall when bumped below the rim', () => {
  const { world, player, r1, events } = start(pitCourse);
  Object.assign(player, { d: 0.05, y: -0.3, grounded: false });
  Object.assign(r1, { d: 0.6, y: -0.2, grounded: false });
  stepWorld(world, {}, TICK_DT);
  expect(player.d).toBeGreaterThanOrEqual(0);
  expect(r1.d - player.d).toBeCloseTo(2 * RUN.radius, 6);
  for (let tick = 0; tick < 40; tick++) stepWorld(world, {}, TICK_DT);
  expect(events.all().filter((event) => event.type === 'racer.fell' && event.id === 'player')).toHaveLength(1);
});

it.each(['airborne', 'exactly 1 m up', 'fallen', 'finished', 'farther ahead'] as const)(
  'does not bump a racer who is %s',
  (condition) => {
    const { world, events, player, r1 } = start();
    r1.d = player.d;
    if (condition === 'airborne') Object.assign(r1, { y: 1.1, grounded: false });
    if (condition === 'exactly 1 m up') Object.assign(r1, { y: 1, vy: RUN.gravity * TICK_DT, grounded: false });
    if (condition === 'fallen') Object.assign(r1, { state: 'fallen', outTicks: 10 });
    if (condition === 'finished') Object.assign(r1, { state: 'finished', finishTicks: 1 });
    if (condition === 'farther ahead') r1.s += 1.05;
    stepWorld(world, {}, TICK_DT);
    expect(player.d).toBe(-1.25);
    expect(events.all().filter((event) => event.type === 'racer.bumped')).toEqual([]);
  },
);

it('separates two rivals that respawn on the same spot', () => {
  const { world, events, r1, r2 } = start();
  for (const racer of [r1, r2]) {
    Object.assign(racer, { state: 'fallen', outTicks: 1, safeS: 45, safeD: 0 });
  }
  stepWorld(world, {}, TICK_DT);
  expect(events.all().slice(-4)).toMatchObject([
    { type: 'racer.respawned', id: 'r1', s: 45, d: 0 },
    { type: 'racer.respawned', id: 'r2', s: 45, d: 0 },
    { type: 'racer.bumped', id: 'r1', by: 'r2' },
    { type: 'racer.bumped', id: 'r2', by: 'r1' },
  ]);
  expect(Math.abs(r1.d - r2.d)).toBeCloseTo(2 * RUN.radius, 6);
});
