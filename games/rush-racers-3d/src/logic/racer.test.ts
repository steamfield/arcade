import { EventLog, TICK_DT } from '@arcade/core';
import { expect, it } from 'vitest';
import { groundY } from './course.ts';
import type { GameEvent } from './events.ts';
import { NO_INPUT, stepRacer } from './racer.ts';
import { DASH, RUN } from './tuning.ts';
import type { Course, Feature, Racer, TickInput } from './types.ts';
import { createWorld, playerOf } from './world.ts';

const straight: Course = {
  id: 'racer-straight',
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
const held = { ...forward, jumpHeld: true };
const jump = { ...held, jumpPressed: true };
const dash = { ...forward, dashPressed: true };
const pit: Feature = { kind: 'pit', s0: 30, s1: 38, d0: -5, d1: 5 };
const log: Feature = { kind: 'log', s: 30, d0: -5, d1: 5, height: 0.8 };

function start(patch: Partial<Course> = {}, startingPose: Partial<Racer> = {}, speedMul = 1) {
  const course = { ...straight, ...patch };
  const world = createWorld(new EventLog<GameEvent>(), { course, seed: 1, character: 'grit', rivals: false });
  const racer = Object.assign(playerOf(world), startingPose);
  const events = new EventLog<GameEvent>();
  function advance(ticks: number, input: TickInput = NO_INPUT) {
    for (let i = 0; i < ticks; i++) {
      events.tick++;
      stepRacer(racer, input, { course, events, raceTicks: events.tick, speedMul }, TICK_DT);
    }
  }
  return { course, racer, events, advance };
}

it('accelerates to running speed, coasts down on release and brakes faster without reversing', () => {
  const { racer, advance } = start();
  advance(1, forward);
  expect(racer.vs).toBeCloseTo(RUN.accel * TICK_DT);
  advance(100, forward);
  expect(racer.vs).toBe(RUN.runSpeed);
  advance(1);
  expect(racer.vs).toBeCloseTo(RUN.runSpeed - RUN.friction * TICK_DT);
  advance(1, { ...forward, brake: true });
  expect(racer.vs).toBeCloseTo(RUN.runSpeed - (RUN.friction + RUN.brake) * TICK_DT);
  advance(100, { ...forward, brake: true });
  expect(racer.vs).toBe(0);
  advance(1, forward);
  advance(100);
  expect(racer.vs).toBe(0);
});

it('runs at its own top speed under a speed multiplier and caps mud from that speed', () => {
  const fast = start({}, {}, 1.1);
  fast.advance(120, forward);
  expect(fast.racer.vs).toBeCloseTo(RUN.runSpeed * 1.1);
  const muddy = start({ features: [{ kind: 'mud', s0: 0, s1: 200, d0: -5, d1: 5 }] }, {}, 1.1);
  muddy.advance(120, forward);
  expect(muddy.racer.vs).toBeCloseTo(RUN.runSpeed * 1.1 * RUN.mudSpeedMul);
});

it.each([-1, 1])('steers at a capped speed and stops at the track edge (%s)', (side) => {
  const { racer, advance } = start();
  const steer = { ...NO_INPUT, steer: side };
  advance(1, steer);
  expect(racer.vd).toBeCloseTo(side * RUN.steerAccel * TICK_DT);
  expect(racer.d).toBeCloseTo(racer.vd * TICK_DT);
  advance(20, steer);
  expect(racer.vd).toBe(side * RUN.steerSpeed);
  advance(120, steer);
  expect(racer.d).toBe(side * (straight.halfWidth - RUN.radius));
  expect(racer.vd).toBe(0);
});

it('jumps on a fresh grounded press, rises higher when held and cannot jump twice in the air', () => {
  const full = start();
  const tap = start();
  full.advance(1, jump);
  tap.advance(1, jump);
  expect(full.events.all()).toMatchObject([{ type: 'racer.jumped', id: 'player', tick: 1 }]);
  expect(full.racer.grounded).toBe(false);
  expect(full.racer.y).toBeGreaterThan(0);
  full.advance(1, held);
  full.advance(1, jump);
  full.advance(20, held);
  tap.advance(22);
  expect(full.racer.y).toBeGreaterThan(tap.racer.y);
  expect(full.events.all().filter((event) => event.type === 'racer.jumped')).toHaveLength(1);
});

it.each([RUN.coyoteTicks, RUN.coyoteTicks + 1])('checks a coyote jump %s ticks after leaving the ledge', (delay) => {
  const { racer, advance, events } = start({ features: [pit] }, { s: 29.9, vs: RUN.runSpeed });
  advance(1, forward);
  expect(racer.grounded).toBe(false);
  advance(delay - 1, forward);
  advance(1, jump);
  const accepted = delay === RUN.coyoteTicks;
  expect(events.all().filter((event) => event.type === 'racer.jumped')).toHaveLength(accepted ? 1 : 0);
  expect(racer.vy > 0).toBe(accepted);
});

it.each([RUN.bufferTicks, RUN.bufferTicks + 1])('checks a jump pressed %s ticks before landing', (lead) => {
  const landingTick = 12;
  const { racer, advance, events } = start({}, { y: 1.25, vy: -3.2, grounded: false });
  advance(landingTick - lead - 1);
  advance(1, jump);
  advance(lead - 1, held);
  expect(racer.grounded).toBe(false);
  expect(events.all()).toEqual([]);
  advance(1, held);
  const accepted = lead === RUN.bufferTicks;
  expect(events.all()).toMatchObject(
    accepted
      ? [
          { type: 'racer.landed', tick: landingTick },
          { type: 'racer.jumped', tick: landingTick },
        ]
      : [{ type: 'racer.landed', tick: landingTick }],
  );
  expect(racer.grounded).toBe(!accepted);
});

it('follows the interpolated ground each tick up and down a hill', () => {
  const { course, racer, advance } = start({
    hills: [
      { s: 0, y: 0 },
      { s: 10, y: 3 },
      { s: 25, y: -1 },
    ],
  });
  for (let i = 0; i < 150; i++) {
    advance(1, forward);
    expect(racer.grounded).toBe(true);
    expect(racer.y).toBe(groundY(course, racer.s));
  }
  expect(racer.s).toBeGreaterThan(25);
});

it('spends dash charges, glides at dash drag and recharges one at a time from the first spend', () => {
  const { racer, advance, events } = start();
  advance(1, dash);
  expect(racer).toMatchObject({ vs: DASH.speed, dashCharges: 1, dashTicks: DASH.burstTicks });
  advance(1, forward);
  expect(racer.vs).toBeCloseTo(DASH.speed - DASH.drag * TICK_DT);
  advance(1, dash);
  expect(racer.dashCharges).toBe(0);
  advance(1, dash);
  expect(racer.vs).toBeCloseTo(DASH.speed - DASH.drag * TICK_DT);
  advance(DASH.rechargeTicks - 5, forward);
  expect(racer).toMatchObject({ vs: RUN.runSpeed, dashCharges: 0, dashTicks: 0 });
  advance(1, forward);
  expect(racer.dashCharges).toBe(0);
  advance(1, forward);
  expect(racer.dashCharges).toBe(1);
  advance(DASH.rechargeTicks - 1, forward);
  expect(racer.dashCharges).toBe(1);
  advance(1, forward);
  expect(racer).toMatchObject({ dashCharges: 2, dashRecharge: 0 });
  expect(events.all()).toMatchObject([
    { type: 'racer.dashed', tick: 1, charges: 1 },
    { type: 'racer.dashed', tick: 3, charges: 0 },
    { type: 'racer.dashRecharged', tick: 1 + DASH.rechargeTicks, charges: 1 },
    { type: 'racer.dashRecharged', tick: 1 + DASH.rechargeTicks * 2, charges: 2 },
  ]);
});

it('falls below the rim and respawns at rest after exactly the out time despite held controls', () => {
  const { racer, advance, events } = start({ features: [pit] });
  advance(149, forward);
  const safe = { s: racer.safeS, d: racer.safeD };
  advance(1, forward);
  expect(racer.y).toBeLessThan(0);
  advance(29, forward);
  expect(racer.y).toBeGreaterThan(-RUN.fallDepth);
  expect(racer.state).toBe('racing');
  advance(1, forward);
  expect(racer).toMatchObject({ state: 'fallen', outTicks: RUN.respawnTicks });
  expect(racer.y).toBeLessThanOrEqual(-RUN.fallDepth);
  const out = { s: racer.s, d: racer.d, y: racer.y };
  const eager = { ...dash, ...jump, dashPressed: true, steer: 1 };
  advance(RUN.respawnTicks - 1, eager);
  expect(racer).toMatchObject({ ...out, state: 'fallen', outTicks: 1 });
  advance(1, eager);
  expect(racer).toMatchObject({
    ...safe,
    y: 0,
    vs: 0,
    vd: 0,
    vy: 0,
    grounded: true,
    state: 'racing',
    invulnTicks: RUN.invulnTicks,
  });
  expect(events.all()).toMatchObject([
    { type: 'racer.fell', s: out.s, tick: 180 },
    { type: 'racer.respawned', ...safe, tick: 180 + RUN.respawnTicks },
  ]);
  advance(RUN.invulnTicks - 1);
  expect(racer.invulnTicks).toBe(1);
  advance(1);
  expect(racer.invulnTicks).toBe(0);
});

it('jumps a pit and lands on the far side without falling', () => {
  const { racer, advance, events } = start({ features: [pit] }, { s: 27.5, vs: RUN.runSpeed });
  advance(1, jump);
  advance(49, held);
  expect(racer.s).toBeGreaterThan(38);
  expect(racer).toMatchObject({ y: 0, grounded: true, state: 'racing' });
  expect(events.all().map((event) => event.type)).toEqual(['racer.jumped', 'racer.landed']);
});

it('keeps the safe spot back from pits at the current lane and respawns between close pits', () => {
  const { racer, advance, events } = start(
    {
      features: [
        { kind: 'pit', s0: 30, s1: 35, d0: -5, d1: 5 },
        { kind: 'pit', s0: 43, s1: 60, d0: -5, d1: 0 },
      ],
    },
    { s: 26.5, vs: RUN.runSpeed, d: -2, safeS: 26.5, safeD: -2 },
  );
  advance(1, jump);
  advance(29, held);
  expect(racer.safeS).toBe(26.5);
  advance(22, held);
  expect(racer.grounded).toBe(true);
  advance(5, { ...held, steer: 1 });
  const safe = { s: racer.s, d: racer.d };
  expect(safe.s).toBeGreaterThan(35);
  expect(safe.s).toBeLessThanOrEqual(43 - RUN.respawnBackoff);
  expect(safe.d).toBeGreaterThan(-2);
  advance(13, held);
  expect(racer).toMatchObject({ safeS: safe.s, safeD: safe.d });
  advance(31, forward);
  advance(RUN.respawnTicks, NO_INPUT);
  expect(racer).toMatchObject({ ...safe, grounded: true, state: 'racing' });
  expect(events.all().at(-1)).toMatchObject({ type: 'racer.respawned', ...safe, tick: 101 + RUN.respawnTicks });
});

it('loses an active dash on falling even at the far wall of a short pit', () => {
  const { racer, advance, events } = start({ features: [{ ...pit, s1: 31 }] }, { s: 29.9, vs: RUN.runSpeed });
  advance(25, forward);
  advance(1, dash);
  expect(racer.dashTicks).toBe(DASH.burstTicks);
  advance(5, forward);
  expect(racer).toMatchObject({ state: 'fallen', dashTicks: 0, vs: 0 });
  expect(events.all().at(-1)).toMatchObject({ type: 'racer.fell', tick: 31 });
});

it('caps running speed in mud and accelerates back up after leaving', () => {
  const { racer, advance } = start(
    { features: [{ kind: 'mud', s0: 1, s1: 3, d0: -5, d1: 5 }] },
    { s: 0.9, vs: RUN.runSpeed },
  );
  advance(1, forward);
  expect(racer.s).toBeGreaterThan(1);
  expect(racer.vs).toBe(RUN.runSpeed * RUN.mudSpeedMul);
  advance(30, forward);
  expect(racer.s).toBeGreaterThan(3);
  expect(racer.vs).toBeGreaterThan(RUN.runSpeed * RUN.mudSpeedMul);
  advance(30, forward);
  expect(racer.vs).toBe(RUN.runSpeed);
});

it('keeps run speed above mud and slows on the tick it lands', () => {
  const { racer, events, advance } = start(
    { features: [{ kind: 'mud', s0: 1, s1: 15, d0: -5, d1: 5 }] },
    { s: 0.9, vs: RUN.runSpeed },
  );
  for (let tick = 1; tick <= 46; tick++) {
    advance(1, tick === 1 ? jump : held);
    expect(racer.grounded).toBe(false);
    expect(racer.s).toBeGreaterThan(1);
    expect(racer.s).toBeLessThan(15);
    expect(racer.vs, `airborne tick ${tick}`).toBe(RUN.runSpeed);
  }
  advance(1, held);
  expect(racer).toMatchObject({ grounded: true, vs: RUN.runSpeed * RUN.mudSpeedMul });
  expect(events.all().at(-1)).toMatchObject({ type: 'racer.landed', tick: 47 });
});

it('keeps run speed on a log above mud', () => {
  const { racer, advance } = start(
    { features: [log, { kind: 'mud', s0: 30, s1: 31, d0: -5, d1: 5 }] },
    { s: 30.2, y: log.height, vs: RUN.runSpeed },
  );
  advance(2, forward);
  expect(racer.s).toBeLessThan(31);
  expect(racer).toMatchObject({ grounded: true, y: log.height, vs: RUN.runSpeed });
});

it('can steer away from the track edge against a gust', () => {
  const edge = straight.halfWidth - RUN.radius;
  const { racer, advance } = start(
    { features: [{ kind: 'gust', s0: 0, s1: 20, d0: -5, d1: 5, push: 4 }] },
    { d: edge },
  );
  advance(7, { ...NO_INPUT, steer: -1 });
  expect(racer.d).toBeLessThan(edge);
  expect(racer.vd).toBeCloseTo(-7 * RUN.steerAccel * TICK_DT);
});

it('applies a gust as lateral motion inside its span and leaves no wind velocity after it', () => {
  const { racer, advance } = start(
    { features: [{ kind: 'gust', s0: 1, s1: 1.5, d0: -5, d1: 5, push: -3 }] },
    { s: 1, vs: RUN.runSpeed },
  );
  advance(3, forward);
  expect(racer.d).toBeCloseTo(-3 * TICK_DT * 3);
  const d = racer.d;
  advance(1, forward);
  expect(racer.s).toBeGreaterThan(1.5);
  expect(racer.d).toBe(d);
});

it('stops at a log face below its top and emits a single bump while held against it', () => {
  const { racer, advance, events } = start({ features: [log] }, { s: 29.9, vs: RUN.runSpeed });
  advance(1, forward);
  expect(racer).toMatchObject({ s: 30, vs: 0, y: 0, grounded: true });
  advance(10, forward);
  expect(events.all()).toMatchObject([{ type: 'racer.bumped', id: 'player', s: 30, tick: 1 }]);
  advance(1, jump);
  advance(30, held);
  expect(racer.s).toBeGreaterThan(31);
});

it('can stop at a log face, stand on the floor and jump again from rest', () => {
  const { racer, advance, events } = start({ features: [log] }, { s: 29.9, vs: RUN.runSpeed });
  advance(1, forward);
  advance(RUN.coyoteTicks + 1);
  expect(racer).toMatchObject({ s: 30, y: 0, grounded: true, vs: 0 });
  advance(1, jump);
  expect(racer.y).toBeGreaterThan(0);
  expect(events.all().at(-1)).toMatchObject({ type: 'racer.jumped', tick: RUN.coyoteTicks + 3 });
});

it('steers around a half-width log while holding forward after a bump', () => {
  const { racer, advance, events } = start({ features: [{ ...log, d1: 0 }] }, { s: 29.9, d: -1, vs: RUN.runSpeed });
  advance(1, forward);
  expect(racer.s).toBe(30);
  advance(40, { ...forward, steer: 1 });
  expect(racer.s).toBeGreaterThan(31);
  expect(racer).toMatchObject({ grounded: true, y: 0 });
  expect(events.all().map((event) => event.type)).toEqual(['racer.bumped']);
});

it('keeps moving forward when steering into the side of a log', () => {
  const { racer, advance, events } = start(
    { features: [{ ...log, d0: 0 }] },
    {
      s: 30.25,
      d: -0.05,
      vs: RUN.runSpeed,
      vd: RUN.steerSpeed,
    },
  );
  advance(1, { ...forward, steer: 1 });
  expect(racer.s).toBeCloseTo(30.25 + RUN.runSpeed * TICK_DT);
  expect(racer).toMatchObject({ d: 0, vd: 0, grounded: true });
  expect(events.all()).toMatchObject([{ type: 'racer.bumped', tick: 1 }]);
});

it('stops the slide along a log face if it reaches a second log', () => {
  const { racer, advance, events } = start(
    {
      features: [
        { ...log, d1: 0 },
        { ...log, s: 29.7, d0: 0.02 },
      ],
    },
    { s: 29.9, d: -0.09, vs: RUN.runSpeed, vd: RUN.steerSpeed },
  );
  advance(1, { ...forward, steer: 1 });
  expect(racer).toMatchObject({ s: 30, d: 0.02, vs: 0, vd: 0, grounded: true });
  expect(events.all()).toMatchObject([
    { type: 'racer.bumped', tick: 1 },
    { type: 'racer.bumped', tick: 1 },
  ]);
});

it('clears a log in a running jump without bumping', () => {
  const { racer, advance, events } = start({ features: [log] }, { s: 26.5, vs: RUN.runSpeed });
  advance(1, jump);
  advance(29, held);
  expect(racer.s).toBeGreaterThan(31);
  expect(events.all().map((event) => event.type)).toEqual(['racer.jumped']);
});

it('lands on the log top, leaves the safe spot on the floor and drops past the far side', () => {
  const { racer, advance, events } = start(
    { features: [log] },
    { s: 30.2, y: 0.9, vy: -6, grounded: false, safeS: 29 },
  );
  advance(1);
  expect(racer).toMatchObject({ grounded: true, y: 0.8, safeS: 29 });
  advance(10);
  expect(racer.safeS).toBe(29);
  advance(17, forward);
  expect(racer.s).toBeGreaterThan(31);
  expect(racer).toMatchObject({ grounded: false, safeS: 29 });
  expect(racer.y).toBeGreaterThan(0);
  advance(20, forward);
  expect(racer).toMatchObject({ grounded: true, y: 0 });
  expect(racer.safeS).toBe(racer.s);
  expect(events.all().filter((event) => event.type === 'racer.landed')).toHaveLength(2);
});
