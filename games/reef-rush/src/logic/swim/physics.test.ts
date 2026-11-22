import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { PLAYER_PROFILE } from '../ai/profiles.ts';
import type { GameEvent } from '../events.ts';
import { noItems } from '../racers.ts';
import type { Environment, MoveModifiers, Racer, Vec } from '../types.ts';
import { applyIntent, BASE_MODIFIERS, SWIM } from './physics.ts';

const WATER: Environment = { current: null, inKelp: false };
const CRUISE = SWIM.force / SWIM.drag;
const STILL: Vec = { x: 0, y: 0 };
const RIGHT: Vec = { x: 1, y: 0 };
/** Long enough for any speed to settle. */
const SETTLE = 600;

function makeRacer(): Racer {
  return {
    id: 'player',
    body: { x: 40, y: 40, vx: 0, vy: 0, w: SWIM.width, h: SWIM.height },
    facing: 1,
    kickCooldown: 0,
    progress: Number.POSITIVE_INFINITY,
    place: 1,
    finished: null,
    ai: null,
    profile: PLAYER_PROFILE,
    ...noItems(),
  };
}

interface Hold {
  move?: Vec;
  kick?: boolean;
  env?: Environment;
  mods?: MoveModifiers;
}

/** Holds an intent for `ticks` and returns the highest speed seen after any tick, plus the event log. */
function swim(
  racer: Racer,
  ticks: number,
  { move = STILL, kick = false, env = WATER, mods = BASE_MODIFIERS }: Hold = {},
) {
  const log = new EventLog<GameEvent>(10_000);
  let top = 0;
  for (let i = 0; i < ticks; i++) {
    log.tick = i;
    applyIntent(racer, { move, kick, burst: false }, env, mods, log, TICK_DT);
    top = Math.max(top, speed(racer));
  }
  return { top, log };
}

const speed = (racer: Racer) => Math.hypot(racer.body.vx, racer.body.vy);

/** Settled speed holding `move` from rest. */
function settledSpeed(hold: Hold): number {
  const racer = makeRacer();
  swim(racer, SETTLE, hold);
  return speed(racer);
}

/** Velocity a kick on one tick adds, compared with the same tick without the kick. */
function kickImpulse(prepare: (racer: Racer) => void, move: Vec): Vec {
  const kicked = makeRacer();
  const plain = makeRacer();
  prepare(kicked);
  prepare(plain);
  swim(kicked, 1, { move, kick: true });
  swim(plain, 1, { move });
  return { x: kicked.body.vx - plain.body.vx, y: kicked.body.vy - plain.body.vy };
}

/** A kick may be applied before or after this tick's drag, so its size lands in this range. */
const KICK_RANGE = [SWIM.kick * (1 - SWIM.drag * TICK_DT) - 1e-6, SWIM.kick + 1e-6] as const;

describe('swimming', () => {
  it('reaches cruise speed holding a direction from rest and goes no faster', () => {
    const racer = makeRacer();
    let topX = 0;
    for (let i = 0; i < SETTLE; i++) {
      swim(racer, 1, { move: RIGHT });
      topX = Math.max(topX, racer.body.vx);
    }

    expect(racer.body.vx).toBeGreaterThan(CRUISE * 0.9);
    expect(topX).toBeLessThanOrEqual(CRUISE + 1e-6);
  });

  it('cruises at the same speed diagonally as straight', () => {
    expect(settledSpeed({ move: { x: 1, y: -1 } })).toBeCloseTo(settledSpeed({ move: { x: 0, y: -1 } }), 5);
  });

  it('slows by drag once input is released', () => {
    const racer = makeRacer();
    swim(racer, SETTLE, { move: RIGHT });
    const cruising = racer.body.vx;

    swim(racer, 1);
    expect(racer.body.vx).toBeCloseTo(cruising * (1 - SWIM.drag * TICK_DT), 6);

    swim(racer, 300);
    expect(Math.abs(racer.body.vx)).toBeLessThan(0.5);
  });

  it('sinks slowly with no vertical input and drifts nowhere sideways', () => {
    const racer = makeRacer();
    swim(racer, SETTLE);

    expect(racer.body.vx).toBe(0);
    expect(racer.body.vy).toBeGreaterThan((SWIM.sink / SWIM.drag) * 0.9);
    expect(racer.body.vy).toBeLessThanOrEqual(SWIM.sink / SWIM.drag + 1e-6);
  });

  it('changes velocity only, never position', () => {
    const racer = makeRacer();
    swim(racer, 60, { move: { x: 1, y: 1 }, kick: true });

    expect(racer.body).toMatchObject({ x: 40, y: 40 });
  });

  it('scales cruise speed by forceMul', () => {
    const boosted = settledSpeed({ move: RIGHT, mods: { ...BASE_MODIFIERS, forceMul: 1.5 } });

    expect(boosted / settledSpeed({ move: RIGHT })).toBeCloseTo(1.5, 5);
  });

  it('never exceeds the speed cap however hard it is pushed', () => {
    const racer = makeRacer();
    const mods: MoveModifiers = { forceMul: 4, kickMul: 3, kickCooldownTicks: 0, dragMul: 1 };
    const { top } = swim(racer, 120, { move: RIGHT, kick: true, env: { current: RIGHT, inKelp: false }, mods });

    expect(top).toBeLessThanOrEqual(SWIM.maxSpeed + 1e-6);
    expect(speed(racer)).toBeCloseTo(SWIM.maxSpeed, 2);
  });

  it('turns to face horizontal input and keeps facing when there is none', () => {
    const racer = makeRacer();

    swim(racer, 1, { move: { x: -1, y: 0 } });
    expect(racer.facing).toBe(-1);
    swim(racer, 1);
    expect(racer.facing).toBe(-1);
    swim(racer, 1, { move: { x: 0, y: -1 } });
    expect(racer.facing).toBe(-1);
    swim(racer, 1, { move: RIGHT });
    expect(racer.facing).toBe(1);
  });
});

describe('the water', () => {
  it('lowers cruise speed in kelp', () => {
    const inKelp = settledSpeed({ move: RIGHT, env: { current: null, inKelp: true } });

    expect(inKelp).toBeGreaterThan(0);
    expect(inKelp).toBeLessThan(settledSpeed({ move: RIGHT }) / 2);
  });

  it('carries a racer with no input along a current', () => {
    const racer = makeRacer();
    swim(racer, SETTLE, { env: { current: RIGHT, inKelp: false } });

    expect(racer.body.vx).toBeGreaterThan((SWIM.currentForce / SWIM.drag) * 0.9);
    expect(racer.body.vx).toBeLessThanOrEqual(SWIM.currentForce / SWIM.drag + 1e-6);
  });

  it('speeds a racer swimming with a current and slows one swimming against it', () => {
    const still = settledSpeed({ move: RIGHT });
    const withIt = settledSpeed({ move: RIGHT, env: { current: RIGHT, inKelp: false } });
    const against = settledSpeed({ move: RIGHT, env: { current: { x: -1, y: 0 }, inKelp: false } });

    expect(withIt).toBeGreaterThan(still * 1.5);
    expect(against).toBeLessThan(still / 2);
  });
});

describe('kicking', () => {
  it('adds one kick of speed along the input direction, starts the cooldown and announces it', () => {
    const impulse = kickImpulse(() => {}, { x: 1, y: -1 });

    expect(impulse.x).toBeCloseTo(-impulse.y, 6);
    expect(Math.hypot(impulse.x, impulse.y)).toBeGreaterThanOrEqual(KICK_RANGE[0]);
    expect(Math.hypot(impulse.x, impulse.y)).toBeLessThanOrEqual(KICK_RANGE[1]);

    const racer = makeRacer();
    const { log } = swim(racer, 1, { move: RIGHT, kick: true });
    expect(racer.kickCooldown).toBe(BASE_MODIFIERS.kickCooldownTicks);
    expect(log.all()).toMatchObject([{ type: 'racer.kicked', id: 'player' }]);
  });

  it('kicks along facing when there is no input', () => {
    const impulse = kickImpulse((racer) => {
      racer.facing = -1;
    }, STILL);

    expect(impulse.y).toBeCloseTo(0, 6);
    expect(-impulse.x).toBeGreaterThanOrEqual(KICK_RANGE[0]);
    expect(-impulse.x).toBeLessThanOrEqual(KICK_RANGE[1]);
  });

  it('ignores a kick while cooling down and keeps counting down', () => {
    const impulse = kickImpulse((racer) => {
      racer.kickCooldown = 5;
    }, RIGHT);
    expect(impulse).toEqual({ x: 0, y: 0 });

    const racer = makeRacer();
    racer.kickCooldown = 5;
    const { log } = swim(racer, 1, { move: RIGHT, kick: true });
    expect(log.all()).toEqual([]);
    expect(racer.kickCooldown).toBe(4);
  });

  it('kicks again on the first tick after the cooldown reaches zero', () => {
    const racer = makeRacer();
    const mods = { ...BASE_MODIFIERS, kickCooldownTicks: 10 };
    const { log } = swim(racer, 25, { move: RIGHT, kick: true, mods });

    expect(log.all().map((event) => event.tick)).toEqual([0, 11, 22]);
  });
});

describe('a very long tick', () => {
  it('slows a racer in kelp to a stop without reversing it', () => {
    const racer = makeRacer();
    racer.body.vx = 100;
    applyIntent(
      racer,
      { move: STILL, kick: false, burst: false },
      { current: null, inKelp: true },
      BASE_MODIFIERS,
      new EventLog<GameEvent>(),
      0.5,
    );

    expect(racer.body.vx).toBe(0);
    expect(racer.body.vy).toBe(0);
  });
});
