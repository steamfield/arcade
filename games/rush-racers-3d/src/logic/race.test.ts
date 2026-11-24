import { EventLog, TICK_DT } from '@arcade/core';
import { expect, it } from 'vitest';
import type { GameEvent } from './events.ts';
import { hashWorld } from './hash.ts';
import { NO_INPUT } from './racer.ts';
import { RACE } from './tuning.ts';
import type { Course, TickInput } from './types.ts';
import { createWorld, playerOf, stepWorld } from './world.ts';

const course: Course = {
  id: 'straight',
  name: 'Straight',
  path: [{ kind: 'straight', length: 200 }],
  halfWidth: 5,
  hills: [],
  startS: 0,
  finishS: 200,
  parTicks: 900,
  features: [],
};
const forward = { ...NO_INPUT, forward: true };

function start(layout = course) {
  const events = new EventLog<GameEvent>();
  const world = createWorld(events, { course: layout, seed: 4, character: 'grit', rivals: false });
  function advance(ticks: number, input?: TickInput) {
    for (let i = 0; i < ticks; i++) {
      events.tick = world.tick === 0 ? 0 : world.tick + 1;
      stepWorld(world, input ? { player: input } : {}, TICK_DT);
    }
  }
  return { world, events, player: playerOf(world), advance };
}

it('counts down at ticks 0, 60 and 120 and starts at 180 without moving', () => {
  const { world, events, player, advance } = start();
  const startPlayer = { ...player };
  const eager = { ...forward, steer: 1, jumpPressed: true, dashPressed: true };
  expect(world.phase).toBe('countdown');
  advance(179, eager);
  expect(world).toMatchObject({ phase: 'countdown', tick: 179, raceTicks: 0 });
  expect(player).toEqual(startPlayer);
  advance(1, eager);
  expect(world).toMatchObject({ phase: 'racing', tick: 180, raceTicks: 0 });
  expect(player).toEqual(startPlayer);
  expect(events.all()).toEqual([
    { type: 'race.countdown', tick: 0, seq: 0, n: 3 },
    { type: 'race.countdown', tick: 60, seq: 1, n: 2 },
    { type: 'race.countdown', tick: 120, seq: 2, n: 1 },
    { type: 'race.started', tick: RACE.countdownTicks, seq: 3 },
  ]);
  advance(1, forward);
  expect(world.raceTicks).toBe(1);
  expect(player.s).toBeGreaterThan(course.startS);
});

it('finishes on the crossing tick, clamps to the line and freezes the world', () => {
  const { world, player, advance, events } = start({ ...course, finishS: 5 });
  advance(RACE.countdownTicks + 41, forward);
  expect(player.finishTicks).toBeNull();
  advance(1, forward);
  expect(player).toMatchObject({ state: 'finished', finishTicks: 42, s: 5, vs: 0, vd: 0, vy: 0 });
  expect(world).toMatchObject({ phase: 'finished', raceTicks: 42 });
  expect(events.all().slice(-2)).toMatchObject([
    { type: 'racer.finished', id: 'player', ticks: 42, tick: 222 },
    { type: 'race.ended', ticks: 42, tick: 222 },
  ]);
  const finished = hashWorld(world);
  advance(32, { ...forward, steer: -1, jumpPressed: true, dashPressed: true });
  expect(hashWorld(world)).toBe(finished);
  expect(events.all().filter((event) => event.type === 'race.ended')).toHaveLength(1);
});

it('ends at the race limit with no finish time for a stationary player', () => {
  const { world, player, advance, events } = start();
  advance(RACE.countdownTicks + RACE.limitTicks - 1);
  expect(world.phase).toBe('racing');
  advance(1);
  expect(world).toMatchObject({ phase: 'finished', raceTicks: RACE.limitTicks });
  expect(player.finishTicks).toBeNull();
  expect(events.all().at(-1)).toMatchObject({ type: 'race.ended', ticks: RACE.limitTicks });
});

it('leaves the finish time empty if the race limit hits during a fall', () => {
  const { world, player, advance, events } = start({
    ...course,
    features: [{ kind: 'pit', s0: 30, s1: 45, d0: -5, d1: 5 }],
  });
  advance(RACE.countdownTicks + RACE.limitTicks - 181);
  advance(180, forward);
  expect(player.state).toBe('fallen');
  advance(1, forward);
  expect(world.phase).toBe('finished');
  expect(player).toMatchObject({ state: 'fallen', finishTicks: null });
  expect(events.all().at(-1)).toMatchObject({ type: 'race.ended', ticks: RACE.limitTicks });
});

it('replays a script to the same hash and excludes the course and event sink', () => {
  function play(steer: number) {
    const { world, advance } = start();
    advance(RACE.countdownTicks + 60, forward);
    advance(1, { ...forward, steer, jumpPressed: true, jumpHeld: true });
    advance(30, { ...forward, steer, jumpHeld: true });
    return world;
  }
  const first = play(1);
  expect(hashWorld(first)).toBe(hashWorld(play(1)));
  expect(hashWorld(first)).not.toBe(hashWorld(play(-1)));
  expect(hashWorld(first)).toBe(
    hashWorld({
      ...first,
      course: { ...course, id: 'other', name: 'Other', parTicks: 1100 },
      events: new EventLog<GameEvent>(),
    }),
  );
});
