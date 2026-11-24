/**
 * Flight's physics: gravity, the flap, the glide, the dive and its carry, cruising with momentum, the
 * dash, the surroundings and Easy's lighter gravity. Speeds are measured on bare flyers through
 * `applyFlightIntent`; dash charges, a stun mid-dive, the surroundings and Easy through `createWorld` on small inline
 * courses. Every number is read from `FLIGHT_TUNING` or the world's effective tuning.
 */
import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { jumpMulFor } from '../../abilities.ts';
import { applyHit } from '../../hazards/hits.ts';
import { centreOf } from '../../racers.ts';
import { eventsIn, hold, IDLE, step } from '../../test-world.ts';
import { CHARACTER_IDS, type Intent, TILE, type Vec } from '../../types.ts';
import { effectiveTuning } from '../index.ts';
import type { FlightEnv } from './data.ts';
import { sampleFlightEnvironment } from './env.ts';
import { bareFlyer, flightWorld, fly, STILL_AIR, ticksIn, ticksOfRacer } from './test-kit.ts';
import { FLIGHT_TUNING } from './tuning.ts';

const BASE = FLIGHT_TUNING.base;
const { cruise, gravity, maxFall, flapLift, flapCooldownTicks, glideFall, diveMaxFall, windSpeed, fogCruiseMul } =
  FLIGHT_TUNING.extra;
const RIGHT: Vec = { x: 1, y: 0 };
const LEFT: Vec = { x: -1, y: 0 };
const UP: Vec = { x: 0, y: -1 };
const DOWN: Vec = { x: 0, y: 1 };
const DOWN_RIGHT: Vec = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
const STILL: Vec = { x: 0, y: 0 };

/** Up pressed on exactly the ticks in `pressTicks`, nothing on the rest. */
function upOn(...pressTicks: number[]): (tick: number) => Intent {
  return (tick) => (pressTicks.includes(tick) ? hold(UP) : IDLE);
}

/** Open sky 8 tiles high over a floor, the player's start on the floor. */
const OPEN = [
  '...................F',
  '...................F',
  '...................F',
  '...................F',
  '...................F',
  '...................F',
  '...................F',
  '.1.................F',
  '####################',
];

/** Open sky 24 tiles high over a floor, the player's start at the top: room for a 1 s dive. */
const TALL = ['.1.................F', ...Array.from({ length: 23 }, () => '...................F'), '#'.repeat(20)];

describe('gravity', () => {
  it('pulls a flyer with no input down by gravity * dt a tick, never past maxFall', () => {
    const { samples } = fly(bareFlyer(), ticksIn(2), IDLE);
    const vys = samples.map((sample) => sample.vy);

    expect(vys.slice(0, 5)).toEqual([1, 2, 3, 4, 5].map((tick) => tick * gravity * TICK_DT));
    expect(Math.max(...vys)).toBe(maxFall);
    expect(vys.at(-1)).toBe(maxFall);
  });
});

describe('flap', () => {
  it('flaps on a fresh Up press: racer.flapped, vy at most -flapLift, and no dash', () => {
    const racer = bareFlyer();
    const { log } = fly(racer, 1, hold(UP));

    expect(racer.body.vy).toBeLessThanOrEqual(-flapLift);
    expect(eventsIn(log)).toEqual([{ type: 'racer.flapped', id: 'player' }]);
    expect(racer.kickCooldown).toBe(0);
  });

  it('never spends a dash charge in a race', () => {
    const { world, log, player } = flightWorld(OPEN);
    const charges = player.kickCharges;
    step(world, log, 1, hold(UP));

    expect(ticksOfRacer(log, 'racer.flapped')).toEqual([world.tick]);
    expect(ticksOfRacer(log, 'racer.kicked')).toEqual([]);
    expect(player.kickCharges).toBe(charges);
  });

  it('flaps once however long Up is held', () => {
    const { log } = fly(bareFlyer(), ticksIn(2), hold(UP));

    expect(ticksOfRacer(log, 'racer.flapped')).toEqual([0]);
  });

  it(`drops a new press ${flapCooldownTicks - 1} ticks after a flap, inside the cooldown`, () => {
    const { log } = fly(bareFlyer(), 60, upOn(0, flapCooldownTicks - 1));

    expect(ticksOfRacer(log, 'racer.flapped')).toEqual([0]);
  });

  it(`flaps again on a new press ${flapCooldownTicks} ticks after a flap`, () => {
    const { log } = fly(bareFlyer(), 60, upOn(0, flapCooldownTicks));

    expect(ticksOfRacer(log, 'racer.flapped')).toEqual([0, flapCooldownTicks]);
  });

  it('climbs at least 3 tiles in 2 s tapping Up as fast as the cooldown allows, from a hover', () => {
    const racer = bareFlyer();
    const start = racer.body.y;
    const presses = Array.from({ length: ticksIn(2) }, (_, tick) => tick).filter(
      (tick) => tick % flapCooldownTicks === 0,
    );
    const { samples, log } = fly(racer, ticksIn(2), upOn(...presses));

    expect(ticksOfRacer(log, 'racer.flapped')).toEqual(presses);
    expect(start - Math.min(...samples.map((sample) => sample.y))).toBeGreaterThanOrEqual(3 * TILE);
  });

  it.each(CHARACTER_IDS)('flaps %s with flapLift times its jump multiplier (Gil 1.12, others 1)', (character) => {
    const racer = bareFlyer(character);
    fly(racer, 1, hold(UP));

    expect(jumpMulFor(racer)).toBe(character === 'gil' ? 1.12 : 1);
    expect(racer.body.vy).toBeCloseTo(-flapLift * jumpMulFor(racer), 9);
  });
});

describe('glide', () => {
  it('keeps the fall at or under glideFall while Up is held, and falls freely again once it is let go', () => {
    const racer = bareFlyer();
    const held = fly(racer, ticksIn(2), hold(UP)).samples.map((sample) => sample.vy);
    const released = fly(racer, ticksIn(1), IDLE).samples.map((sample) => sample.vy);

    expect(Math.max(...held)).toBe(glideFall);
    expect(held.at(-1)).toBe(glideFall);
    expect(released[0]).toBeGreaterThan(glideFall);
    expect(released.at(-1)).toBe(maxFall);
  });
});

describe('dive', () => {
  it('falls faster holding Down than falling freely, up to diveMaxFall', () => {
    const dive = fly(bareFlyer(), ticksIn(2), hold(DOWN)).samples.map((sample) => sample.vy);
    const free = fly(bareFlyer(), ticksIn(2), IDLE).samples.map((sample) => sample.vy);

    expect(dive.every((vy, tick) => vy >= (free[tick] ?? Number.NaN))).toBe(true);
    expect(dive[ticksIn(0.5)]).toBeGreaterThan(free[ticksIn(0.5)] ?? Number.NaN);
    expect(Math.max(...dive)).toBe(diveMaxFall);
  });

  it('carries a 1 s dive into forward speed over cruise, still over it 1 s later, and back to cruise within 3 s', () => {
    const racer = bareFlyer();
    fly(racer, ticksIn(1), hold(DOWN_RIGHT));
    const speeds = fly(racer, ticksIn(3), hold(RIGHT)).samples.map((sample) => sample.vx);

    expect(speeds[0]).toBeGreaterThan(cruise);
    expect(speeds[ticksIn(1)]).toBeGreaterThan(cruise);
    expect(speeds.at(-1)).toBe(cruise);
  });

  it('carries a dive into 0.8x the forward speed at forceMul 0.6, the share of it that cruise gets', () => {
    const carried = (forceMul: number) => {
      const racer = bareFlyer();
      const mods = { ...BASE, forceMul };
      fly(racer, ticksIn(1), hold(DOWN), { mods });
      fly(racer, 1, hold(STILL), { mods });
      return racer.body.vx;
    };

    expect(carried(1)).toBeGreaterThan(0);
    expect(carried(0.6)).toBeCloseTo(0.8 * carried(1), 9);
  });

  it('pays no carry on a dive a stun ends: the knockback still points back against facing', () => {
    const { world, log, player } = flightWorld(TALL);
    step(world, log, ticksIn(1), hold(DOWN_RIGHT));
    const diveSpeed = player.body.vy;
    const ahead = { x: centreOf(player).x + player.facing * TILE, y: centreOf(player).y };
    applyHit(world, player, 'lightning', null, ahead);
    step(world, log, 1, hold(DOWN_RIGHT));

    expect(diveSpeed).toBe(diveMaxFall);
    expect(player.status.stunned).toBeGreaterThan(0);
    expect(player.facing).toBe(1);
    expect(player.body.vx).toBeLessThan(0);
  });
});

describe('cruise', () => {
  it('reaches cruise within 0.6 s holding right, and holds it', () => {
    const speeds = fly(bareFlyer(), ticksIn(2), hold(RIGHT)).samples.map((sample) => sample.vx);

    expect(speeds[ticksIn(0.6) - 1]).toBe(cruise);
    expect(Math.max(...speeds)).toBe(cruise);
    expect(speeds.at(-1)).toBe(cruise);
  });

  it('coasts on letting go: still over half cruise 0.3 s later', () => {
    const racer = bareFlyer();
    racer.body.vx = cruise;
    const speeds = fly(racer, ticksIn(0.3), hold(STILL)).samples.map((sample) => sample.vx);

    expect(speeds.at(-1)).toBeGreaterThan(cruise / 2);
    expect(speeds.at(-1)).toBeLessThan(cruise);
  });

  it('flies 20 % faster with forceMul 1.4, half its deviation', () => {
    const speeds = fly(bareFlyer(), ticksIn(2), hold(RIGHT), { mods: { ...BASE, forceMul: 1.4 } }).samples;

    expect(speeds.at(-1)?.vx).toBeCloseTo(cruise * 1.2, 9);
  });

  it('bleeds speed over cruise twice as fast with dragMul 2', () => {
    const lossWith = (dragMul: number) => {
      const racer = bareFlyer();
      racer.body.vx = FLIGHT_TUNING.maxSpeed;
      const speeds = fly(racer, 10, hold(RIGHT), { mods: { ...BASE, dragMul } }).samples;
      return FLIGHT_TUNING.maxSpeed - (speeds.at(-1)?.vx ?? Number.NaN);
    };

    expect(lossWith(1)).toBeGreaterThan(0);
    expect(lossWith(2)).toBeCloseTo(2 * lossWith(1), 9);
  });

  it('never flies faster than maxSpeed horizontally, even with forceMul 6 and the dash held', () => {
    const strong = { ...BASE, forceMul: 6, kickMul: 3 };
    const speeds = fly(bareFlyer(), ticksIn(2), hold(RIGHT, { kick: true }), { mods: strong }).samples;

    expect(Math.max(...speeds.map((sample) => Math.abs(sample.vx)))).toBe(FLIGHT_TUNING.maxSpeed);
  });
});

describe('dash', () => {
  it('sets forward speed to kick * kickMul along facing, emits racer.kicked and leaves vy alone', () => {
    const withDash = bareFlyer();
    const without = bareFlyer();
    for (const racer of [withDash, without]) {
      racer.facing = -1;
      racer.body.vy = -50;
    }
    const mods = { ...BASE, kickMul: 1.1 };
    const { log } = fly(withDash, 1, hold(STILL, { kick: true }), { mods });
    fly(without, 1, hold(STILL), { mods });

    expect(withDash.body.vx).toBeCloseTo(-FLIGHT_TUNING.kick * 1.1, 9);
    expect(withDash.body.vy).toBe(without.body.vy);
    expect(eventsIn(log)).toEqual([{ type: 'racer.kicked', id: 'player' }]);
  });

  it('dashes at 0.8x kick * kickMul with forceMul 0.6, the share of it that cruise gets', () => {
    const racer = bareFlyer();
    fly(racer, 1, hold(STILL, { kick: true }), { mods: { ...BASE, forceMul: 0.6, kickMul: 1.1 } });

    expect(Math.abs(racer.body.vx)).toBeCloseTo(FLIGHT_TUNING.kick * 1.1 * 0.8, 9);
  });

  it('bleeds the surplus over cruise at drag a second', () => {
    const racer = bareFlyer();
    fly(racer, 1, hold(RIGHT, { kick: true }));
    const speeds = fly(racer, 10, hold(RIGHT)).samples.map((sample) => sample.vx);

    expect(speeds.at(-1)).toBeCloseTo(FLIGHT_TUNING.kick - 10 * FLIGHT_TUNING.drag * TICK_DT, 9);
  });

  it('waits kickCooldownTicks between dashes', () => {
    const { log } = fly(bareFlyer(), 150, hold(RIGHT, { kick: true }));
    const dashes = ticksOfRacer(log, 'racer.kicked');
    const gaps = dashes.slice(1).map((tick, index) => tick - (dashes[index] ?? 0));

    expect(dashes.length).toBeGreaterThanOrEqual(3);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(BASE.kickCooldownTicks);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(BASE.kickCooldownTicks + 1);
  });
});

describe('surroundings', () => {
  const air = (wind: Vec | null, inFog = false): FlightEnv => ({ kind: 'flight', wind, inFog });

  it('is carried along a gust coasting, and helped or held back by one flying', () => {
    const settled = (wind: Vec, move: Vec) =>
      fly(bareFlyer(), ticksIn(3), hold(move), { env: air(wind) }).samples.at(-1)?.vx ?? Number.NaN;

    expect([settled(RIGHT, STILL), settled(LEFT, STILL), settled(RIGHT, RIGHT), settled(LEFT, RIGHT)]).toEqual([
      windSpeed,
      -windSpeed,
      cruise + windSpeed,
      cruise - windSpeed,
    ]);
  });

  it('lifts a gliding flyer in an updraft, and pushes a falling one down in a downdraft', () => {
    const racer = bareFlyer();
    fly(racer, ticksIn(2), hold(UP));
    const gliding = racer.body.y;
    fly(racer, ticksIn(1), hold(UP), { env: air(UP) });
    const fallIn = (wind: Vec | null) => fly(bareFlyer(), 20, IDLE, { env: air(wind) }).samples.at(-1)?.vy ?? 0;

    expect(racer.body.y).toBeLessThan(gliding);
    expect(racer.body.vy).toBeLessThan(0);
    expect(fallIn(DOWN)).toBeGreaterThan(fallIn(null));
  });

  it('never lifts a flyer faster than maxFall in an updraft, however long it rides one', () => {
    const vys = fly(bareFlyer(), ticksIn(2), IDLE, { env: air(UP) }).samples.map((sample) => sample.vy);

    expect(Math.min(...vys)).toBe(-maxFall);
    expect(vys.at(-1)).toBe(-maxFall);
  });

  it('lowers cruise to fogCruiseMul in fog', () => {
    const speeds = fly(bareFlyer(), ticksIn(2), hold(RIGHT), { env: air(null, true) }).samples;

    expect(speeds.at(-1)?.vx).toBeCloseTo(cruise * fogCruiseMul, 9);
  });

  it('reads gusts, drafts and fog banks from the cells under the flyer', () => {
    const { world, player } = flightWorld(['.>.<.^.v.~.F', '.1.........F', '############']);
    const at = (column: number) => {
      player.body.x = column * TILE + 2;
      player.body.y = 3 * TILE + 2;
      return sampleFlightEnvironment(world, player);
    };

    expect([1, 3, 5, 7, 9, 0].map(at)).toEqual([air(RIGHT), air(LEFT), air(UP), air(DOWN), air(null, true), STILL_AIR]);
  });
});

describe('Easy', () => {
  /** The player's highest climb off the floor, px, tapping Up every flapCooldownTicks for 0.5 s on `difficulty`. */
  function tappedClimb(difficulty: 'easy' | 'hard') {
    const { world, log, player } = flightWorld(OPEN, { difficulty });
    const start = player.body.y;
    let top = start;
    const cooldown = effectiveTuning(world).extra.flapCooldownTicks ?? Number.NaN;
    for (let tick = 0; tick < ticksIn(0.5); tick++) {
      step(world, log, 1, tick % cooldown === 0 ? hold(UP) : IDLE);
      top = Math.min(top, player.body.y);
    }
    return start - top;
  }

  it('flies lighter with stronger flaps: a tapped climb gains more height than on Hard', () => {
    expect(tappedClimb('easy')).toBeGreaterThan(tappedClimb('hard'));
  });
});
