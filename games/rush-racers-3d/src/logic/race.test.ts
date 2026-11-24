import { EventLog, TICK_DT } from '@arcade/core';
import { expect, it } from 'vitest';
import { groundY } from './course.ts';
import { THORNWOOD_TRAIL } from './courses/thornwood-trail.ts';
import type { GameEvent } from './events.ts';
import { hashWorld } from './hash.ts';
import { NO_INPUT } from './racer.ts';
import { placeOf, places } from './standings.ts';
import { RACE } from './tuning.ts';
import { CHARACTER_IDS, type Course, type TickInput } from './types.ts';
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
      events.tick = world.tick;
      stepWorld(world, input ? { player: input } : {}, TICK_DT);
    }
  }
  return { world, events, player: playerOf(world), advance };
}

it('counts down at steps 0, 60 and 120 and holds the start line until step 180', () => {
  const { world, events, player, advance } = start();
  const startPlayer = { ...player };
  const eager = { ...forward, steer: 1, jumpPressed: true, dashPressed: true };
  expect(world.phase).toBe('countdown');
  advance(RACE.countdownTicks, eager);
  expect(world).toMatchObject({ phase: 'countdown', tick: 180, raceTicks: 0 });
  expect(player).toEqual(startPlayer);
  advance(1, forward);
  expect(world).toMatchObject({ phase: 'racing', tick: 181, raceTicks: 1 });
  expect(player.s).toBeGreaterThan(course.startS);
  expect(events.all()).toEqual([
    { type: 'race.countdown', tick: 0, seq: 0, n: 3 },
    { type: 'race.countdown', tick: 60, seq: 1, n: 2 },
    { type: 'race.countdown', tick: 120, seq: 2, n: 1 },
    { type: 'race.started', tick: RACE.countdownTicks, seq: 3 },
  ]);
});

it('finishes on the crossing tick, clamps to the line and freezes the world', () => {
  const { world, player, advance, events } = start({ ...course, finishS: 5 });
  advance(RACE.countdownTicks + 41, forward);
  expect(player.finishTicks).toBeNull();
  advance(1, forward);
  expect(player).toMatchObject({ state: 'finished', finishTicks: 42, s: 5, vs: 0, vd: 0, vy: 0 });
  expect(world).toMatchObject({ phase: 'finished', raceTicks: 42 });
  expect(events.all().slice(-2)).toMatchObject([
    { type: 'racer.finished', id: 'player', ticks: 42, tick: 221 },
    { type: 'race.ended', ticks: 42, tick: 221 },
  ]);
  const finished = hashWorld(world);
  advance(32, { ...forward, steer: -1, jumpPressed: true, dashPressed: true });
  expect(hashWorld(world)).toBe(finished);
  expect(events.all().filter((event) => event.type === 'race.ended')).toHaveLength(1);
});

it('grounds the racer on the finish line after crossing it in the air', () => {
  const uphill: Course = {
    ...course,
    finishS: 20,
    hills: [
      { s: 0, y: 0 },
      { s: 20, y: 2 },
    ],
  };
  const { advance, player, world } = start(uphill);
  const held = { ...forward, jumpHeld: true };
  advance(RACE.countdownTicks + 89, forward);
  advance(1, { ...held, jumpPressed: true });
  advance(16, held);
  expect(player).toMatchObject({ grounded: false, state: 'racing' });
  expect(player.y).toBeGreaterThan(groundY(uphill, uphill.finishS));
  advance(1, held);
  expect(world.phase).toBe('finished');
  expect(player).toMatchObject({
    s: uphill.finishS,
    y: groundY(uphill, uphill.finishS),
    grounded: true,
    state: 'finished',
    finishTicks: 107,
  });
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

it('lines up four distinct characters and draws rivals from the seed', () => {
  function grid(seed: number) {
    return createWorld(new EventLog<GameEvent>(), { course, seed, character: 'shade', rivals: true });
  }
  const world = grid(1);
  expect(world.racers.map(({ id, d }) => [id, d])).toEqual([
    ['player', -1.25],
    ['r1', 1.25],
    ['r2', -3.75],
    ['r3', 3.75],
  ]);
  expect(world.racers[0]).toMatchObject({ character: 'shade', s: course.startS, safeD: -1.25 });
  const draws = Array.from({ length: 20 }, (_, i) => {
    const racers = grid(i + 1).racers;
    const characters = racers.map(({ character }) => character);
    expect(new Set(characters).size).toBe(4);
    expect(characters.every((character) => CHARACTER_IDS.includes(character))).toBe(true);
    return characters.slice(1).join(',');
  });
  expect(new Set(draws).size).toBeGreaterThan(1);
  expect(grid(1).racers).toEqual(world.racers);
  expect(grid(1).rngState).toBe(world.rngState);
  expect(world.rngState).not.toBe(1);
});

function pack(finishS = 200) {
  const events = new EventLog<GameEvent>();
  const world = createWorld(events, { course: { ...course, finishS }, seed: 4, character: 'grit', rivals: true });
  for (let i = 0; i <= RACE.countdownTicks; i++) stepWorld(world, {}, TICK_DT);
  const [player, r1, r2, r3] = world.racers;
  if (!player || !r1 || !r2 || !r3) throw new Error('expected four racers');
  return { world, events, player, r1, r2, r3 };
}

it('ranks finishers by time, then unfinished racers by distance, with ties in slot order', () => {
  const { world, r1, r2, r3, player } = pack();
  player.s = 20;
  r1.s = 20;
  r2.s = 40;
  r3.s = 40;
  expect(places(world)).toEqual(['r2', 'r3', 'player', 'r1']);
  expect(placeOf(world, 'player')).toBe(3);
  r1.s = 199.99;
  r1.vs = 14;
  stepWorld(world, {}, TICK_DT);
  expect(places(world)).toEqual(['r1', 'r2', 'r3', 'player']);
  r2.s = 199.99;
  r3.s = 199.99;
  r2.vs = 14;
  r3.vs = 15;
  stepWorld(world, {}, TICK_DT);
  expect(places(world)).toEqual(['r1', 'r2', 'r3', 'player']);
  expect(placeOf(world, 'r3')).toBe(3);
  expect(world.endTick).toBe(world.tick + RACE.rivalsDoneGraceTicks);
});

it('ends on the player crossing, with same-tick places and one finish event per racer', () => {
  const { world, events, player, r1, r2, r3 } = pack();
  r2.s = 199.99;
  r2.vs = 14;
  stepWorld(world, {}, TICK_DT);
  player.s = 199.99;
  player.vs = 14;
  r1.s = 199.99;
  r1.vs = 14;
  r3.s = 120;
  stepWorld(world, { player: forward }, TICK_DT);
  expect(world.phase).toBe('finished');
  expect(places(world)).toEqual(['r2', 'player', 'r1', 'r3']);
  stepWorld(world, { player: forward }, TICK_DT);
  expect(events.all().filter((event) => event.type === 'racer.finished' || event.type === 'race.ended')).toMatchObject([
    { type: 'racer.finished', id: 'r2', ticks: 2, place: 1 },
    { type: 'racer.finished', id: 'player', ticks: 3, place: 2 },
    { type: 'racer.finished', id: 'r1', ticks: 3, place: 3 },
    { type: 'race.ended', ticks: 3, reason: 'player-finished' },
  ]);
  expect(r3.finishTicks).toBeNull();
});

it.each([false, true])('allows the full rival grace period for a player crossing: %s', (crosses) => {
  const { world, events, player, r1, r2, r3 } = pack(40);
  for (const rival of [r1, r2]) {
    rival.s = 39.99;
    rival.vs = 14;
  }
  stepWorld(world, {}, TICK_DT);
  expect(world.endTick).toBeNull();
  r3.s = 39.99;
  r3.vs = 14;
  stepWorld(world, {}, TICK_DT);
  const deadline = world.tick + RACE.rivalsDoneGraceTicks;
  expect(world.endTick).toBe(deadline);
  for (let i = 1; i < RACE.rivalsDoneGraceTicks; i++) stepWorld(world, {}, TICK_DT);
  expect(world).toMatchObject({ phase: 'racing', tick: deadline - 1, endTick: deadline });
  if (crosses) {
    player.s = 39.99;
    player.vs = 14;
  }
  stepWorld(world, { player: forward }, TICK_DT);
  expect(world).toMatchObject({ phase: 'finished', tick: deadline });
  expect(player.finishTicks).toBe(crosses ? 3 + RACE.rivalsDoneGraceTicks : null);
  expect(events.all().at(-1)).toMatchObject({
    type: 'race.ended',
    ticks: 3 + RACE.rivalsDoneGraceTicks,
    reason: crosses ? 'player-finished' : 'rivals-finished',
  });
});

it('enforces the race limit even if the third rival has just finished', () => {
  const { world, events, r1, r2, r3 } = pack();
  world.raceTicks = RACE.limitTicks - 1;
  world.tick = world.raceTicks + RACE.countdownTicks;
  for (const rival of [r1, r2, r3]) {
    rival.s = 199.99;
    rival.vs = 14;
  }
  stepWorld(world, {}, TICK_DT);
  expect(events.all().at(-1)).toMatchObject({ type: 'race.ended', ticks: RACE.limitTicks, reason: 'limit' });
  expect(world.phase).toBe('finished');
});

it('replays the same four-racer script and hash, with seed-dependent rival movement', () => {
  function play(seed: number) {
    const world = createWorld(new EventLog<GameEvent>(), {
      course: THORNWOOD_TRAIL,
      seed,
      character: 'grit',
      rivals: true,
    });
    for (let tick = 0; tick < 850; tick++) {
      stepWorld(
        world,
        {
          player: {
            ...forward,
            steer: tick < 210 ? -0.4 : 0,
            jumpPressed: tick === 425,
            jumpHeld: tick >= 425 && tick < 470,
            dashPressed: tick === 245,
          },
        },
        TICK_DT,
      );
    }
    return world;
  }
  const first = play(1);
  const other = play(2);
  expect(hashWorld(first)).toBe(hashWorld(play(1)));
  expect(hashWorld(first)).not.toBe(hashWorld(other));
  expect(first.racers.slice(1).map(({ s, d }) => [s, d])).not.toEqual(other.racers.slice(1).map(({ s, d }) => [s, d]));
  expect(first.rngState).not.toBe(
    createWorld(new EventLog<GameEvent>(), {
      course: THORNWOOD_TRAIL,
      seed: 1,
      character: 'grit',
      rivals: true,
    }).rngState,
  );
});
