/**
 * Drift's physics: thrust and its cruise limit, coasting, braking, turning, speed over cruise, the
 * dash, the cap, drag, nebula dust, solar wind and Easy's stabilisers. Speeds are measured on bare
 * drifters through `applyDriftIntent`; the surroundings and Easy through `createWorld` on small
 * inline courses. Every number is read from `DRIFT_TUNING` or the world's effective tuning.
 */
import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { ABILITY } from '../../abilities.ts';
import { eventsIn, hold, IDLE, placeOnTile, step } from '../../test-world.ts';
import { CHARACTER_IDS, type Vec } from '../../types.ts';
import { effectiveTuning, MEDIA } from '../index.ts';
import type { DriftEnv } from './data.ts';
import { sampleDriftEnvironment } from './env.ts';
import { applyDriftIntent } from './physics.ts';
import { bareDrifter, drift, driftWorld, RIVAL_LANE_ROWS, ticksIn, VACUUM } from './test-kit.ts';
import { DRIFT_TUNING } from './tuning.ts';

const BASE = DRIFT_TUNING.base;
const { force, drag, maxSpeed, kick } = DRIFT_TUNING;
const { cruise, overDrag, idleBrake, dustCruiseMul, dustDrag, windForce } = DRIFT_TUNING.extra;
const RIGHT: Vec = { x: 1, y: 0 };
const LEFT: Vec = { x: -1, y: 0 };
const UP: Vec = { x: 0, y: -1 };
const DOWN: Vec = { x: 0, y: 1 };
/** Slack for one tick of drag in comparisons against a speed thrust holds. */
const TICK_OF_DRAG = (drag + idleBrake) * TICK_DT + 1e-6;

/** A bare drifter already moving at (`vx`, `vy`). */
function moving(vx: number, vy = 0, character: Parameters<typeof bareDrifter>[0] = 'rudy') {
  const racer = bareDrifter(character);
  racer.body.vx = vx;
  racer.body.vy = vy;
  return racer;
}

describe('thrust', () => {
  it('accelerates from rest at force less drag and settles at cruise, never past it', () => {
    const { samples } = drift(bareDrifter(), ticksIn(1.5), hold(RIGHT));
    const speeds = samples.map((sample) => sample.speed);

    expect(samples[0]?.vx).toBeCloseTo((force - drag) * TICK_DT, 6);
    expect(Math.max(...speeds)).toBeLessThanOrEqual(cruise + 1e-6);
    expect(speeds[ticksIn(1) - 1]).toBeGreaterThanOrEqual(cruise - TICK_OF_DRAG);
    expect(speeds.at(-1)).toBeGreaterThanOrEqual(cruise - TICK_OF_DRAG);
  });

  it('raises cruise by half of what forceMul adds', () => {
    const { samples } = drift(bareDrifter(), ticksIn(1.5), hold(RIGHT), { mods: { ...BASE, forceMul: 1.4 } });

    expect(samples.at(-1)?.speed).toBeGreaterThanOrEqual(cruise * 1.2 - TICK_OF_DRAG);
    expect(Math.max(...samples.map((sample) => sample.speed))).toBeLessThanOrEqual(cruise * 1.2 + 1e-6);
  });
});

describe('coasting', () => {
  it('keeps most of its speed for a second after the stick is let go, losing only drag and the idle brake', () => {
    const racer = moving(cruise);
    const { samples } = drift(racer, ticksIn(1), IDLE);

    expect(samples.at(-1)?.vx).toBeCloseTo(cruise - (drag + idleBrake) * 1, 3);
    expect(samples.at(-1)?.vx).toBeGreaterThan(cruise * 0.7);
    expect(samples.at(-1)?.vy).toBe(0);
  });

  it('keeps its heading when drifting diagonally', () => {
    const racer = moving(60, -80);
    const { samples } = drift(racer, ticksIn(1), IDLE);
    const last = samples.at(-1);

    expect(last?.vx).toBeGreaterThan(0);
    expect(last?.vy).toBeLessThan(0);
    expect((last?.vy ?? 0) / (last?.vx ?? 1)).toBeCloseTo(-80 / 60, 6);
  });
});

describe('braking and turning', () => {
  it('stops a drift by burning against it, in under 0.6 s from cruise, then builds speed the other way', () => {
    const racer = moving(cruise);
    const { samples } = drift(racer, ticksIn(1.5), hold(LEFT));
    const stopped = samples.findIndex((sample) => sample.vx <= 0);

    expect(stopped).toBeGreaterThanOrEqual(0);
    expect(stopped).toBeLessThan(ticksIn(0.6));
    expect(samples.at(-1)?.vx).toBeLessThan(-cruise * 0.5);
  });

  it('turns a drift toward the stick without ever passing cruise', () => {
    const racer = moving(cruise);
    const { samples } = drift(racer, ticksIn(1), hold(UP));
    const last = samples.at(-1);

    expect(Math.max(...samples.map((sample) => sample.speed))).toBeLessThanOrEqual(cruise + 1e-6);
    expect(last?.vy).toBeLessThan(0);
    expect(Math.abs(last?.vy ?? 0)).toBeGreaterThan(Math.abs(last?.vx ?? 0));
  });
});

describe('speed over cruise', () => {
  const FAST = 180;

  it('lasts a while: burning forward never adds to it, and it loses drag plus overDrag a second', () => {
    const { samples } = drift(moving(FAST), ticksIn(1), hold(RIGHT));
    const speeds = samples.map((sample) => sample.speed);

    expect(Math.max(...speeds)).toBeLessThanOrEqual(FAST);
    expect(speeds.at(-1)).toBeCloseTo(FAST - (drag + overDrag) * 1, 3);
  });

  it('is gone within two seconds, leaving the racer at cruise and no slower', () => {
    const { samples } = drift(moving(maxSpeed), ticksIn(2), hold(RIGHT));

    expect(samples.at(-1)?.speed).toBeLessThanOrEqual(cruise + 1e-6);
    expect(samples.at(-1)?.speed).toBeGreaterThanOrEqual(cruise - TICK_OF_DRAG);
  });

  it('can be turned by a burn across it without being spent', () => {
    const { samples } = drift(moving(FAST), ticksIn(1), hold(UP));
    const last = samples.at(-1);

    expect(last?.vy).toBeLessThan(0);
    expect(last?.speed).toBeGreaterThanOrEqual(FAST - (drag + overDrag) * 1 - 1e-6);
    expect(Math.max(...samples.map((sample) => sample.speed))).toBeLessThanOrEqual(FAST + 1e-6);
  });

  it('is shed at thrust strength by burning against it', () => {
    const { samples } = drift(moving(FAST), ticksIn(0.3), hold(LEFT));

    expect(samples.at(-1)?.vx).toBeLessThanOrEqual(FAST - force * 0.3 + 1e-6);
  });
});

describe('the dash', () => {
  it('adds kick along facing with no stick, emits racer.kicked and starts the cooldown', () => {
    const racer = bareDrifter();
    const { log } = drift(racer, 1, hold({ x: 0, y: 0 }, { kick: true }));

    expect(racer.body.vx).toBeGreaterThan(kick - TICK_OF_DRAG);
    expect(racer.body.vx).toBeLessThanOrEqual(kick);
    expect(racer.body.vy).toBe(0);
    expect(eventsIn(log)).toEqual([{ type: 'racer.kicked', id: 'player' }]);
    expect(racer.kickCooldown).toBe(BASE.kickCooldownTicks);
  });

  it('adds speed the racer still has some of a second later', () => {
    const racer = moving(cruise);
    const { samples } = drift(racer, ticksIn(1), (tick) => hold(RIGHT, { kick: tick === 0 }));

    expect(samples[0]?.speed).toBeGreaterThan(cruise + kick - TICK_OF_DRAG);
    expect(samples[ticksIn(0.5)]?.speed).toBeGreaterThan(cruise + kick * 0.6);
    expect(samples.at(-1)?.speed).toBeGreaterThan(cruise + kick * 0.25);
  });

  it('on every recharge down a straight averages well over cruise without sitting at the cap', () => {
    const racer = moving(cruise);
    const { samples } = drift(racer, ticksIn(9), (tick) => hold(RIGHT, { kick: tick % 90 === 0 }));
    const late = samples.slice(ticksIn(3)).map((sample) => sample.speed);
    const mean = late.reduce((sum, speed) => sum + speed, 0) / late.length;

    expect(mean).toBeGreaterThan(cruise + kick * 0.3);
    expect(mean).toBeLessThan(maxSpeed * 0.85);
    expect(Math.min(...late)).toBeLessThan(cruise + kick * 0.25);
  });

  it('scales with kickMul and waits out kickCooldownTicks', () => {
    const strong = bareDrifter();
    drift(strong, 1, hold(RIGHT, { kick: true }), { mods: { ...BASE, kickMul: 1.5 } });
    const racer = bareDrifter();
    const { log } = drift(racer, 100, hold(RIGHT, { kick: true }));
    const kicks = log
      .all()
      .filter((event) => event.type === 'racer.kicked')
      .map((event) => event.tick);

    expect(strong.body.vx).toBeGreaterThan(kick * 1.5 - TICK_OF_DRAG);
    expect(kicks.length).toBeGreaterThanOrEqual(2);
    expect((kicks[1] ?? 0) - (kicks[0] ?? 0)).toBeGreaterThanOrEqual(BASE.kickCooldownTicks);
  });

  it.each([
    ['up', UP],
    ['down', DOWN],
  ] as const)("is 1.8x as strong straight %s for Gil's slot and plain for every other", (_name, dir) => {
    for (const character of CHARACTER_IDS) {
      const racer = bareDrifter(character);
      drift(racer, 1, hold(dir, { kick: true }));
      const expected = character === 'gil' ? kick * ABILITY.springKick.upMul : kick;

      expect(Math.abs(racer.body.vy), character).toBeGreaterThan(expected - TICK_OF_DRAG);
      expect(Math.abs(racer.body.vy), character).toBeLessThanOrEqual(expected + force * TICK_DT);
    }
  });

  it("is plain for Gil's slot when aimed level", () => {
    const gil = bareDrifter('gil');
    drift(gil, 1, hold({ x: 0, y: 0 }, { kick: true }));

    expect(gil.body.vx).toBeLessThanOrEqual(kick);
  });
});

describe('the speed cap', () => {
  it('holds with forceMul 6 and the dash held, and with wind behind', () => {
    const pushed = drift(bareDrifter(), ticksIn(3), hold(RIGHT, { kick: true }), { mods: { ...BASE, forceMul: 6 } });
    const wind: DriftEnv = { ...VACUUM, wind: RIGHT };
    const blown = drift(bareDrifter(), ticksIn(5), hold(RIGHT, { kick: true }), { env: wind });

    for (const { samples } of [pushed, blown]) {
      const top = Math.max(...samples.map((sample) => sample.speed));
      expect(top).toBeLessThanOrEqual(maxSpeed + 1e-9);
      expect(top).toBeGreaterThan(maxSpeed * 0.95);
    }
  });
});

describe('drag', () => {
  it('takes twice as much off a coasting racer when dragMul doubles', () => {
    const lossWith = (dragMul: number) => {
      const racer = moving(100);
      drift(racer, 30, IDLE, { mods: { ...BASE, dragMul } });
      return 100 - racer.body.vx;
    };

    expect(lossWith(2)).toBeCloseTo(lossWith(1) * 2, 6);
    expect(lossWith(1)).toBeGreaterThan(0);
  });
});

describe('nebula dust', () => {
  const DUST: DriftEnv = { ...VACUUM, inDust: true };

  // Slingshot Alley's Easy catch-up floor, Baron's ramp, inflation and a latch can reach about 0.057.
  it.each([0.6, 0.057])('lets a drifter with forceMul %s move from rest under thrust', (forceMul) => {
    const racer = bareDrifter();
    const start = racer.body.x;
    drift(racer, ticksIn(1), hold(RIGHT), { env: DUST, mods: { ...BASE, forceMul } });

    expect(racer.body.x - start).toBeGreaterThan(0);
    expect(racer.body.vx).toBeGreaterThan(0);
  });

  it('settles at the dust cruise with full thrust', () => {
    const { samples } = drift(bareDrifter(), ticksIn(2), hold(RIGHT), { env: DUST });
    const top = Math.max(...samples.map((sample) => sample.speed));

    expect(top).toBeLessThanOrEqual(cruise * dustCruiseMul + 1e-6);
    expect(samples.at(-1)?.speed).toBeGreaterThan(cruise * dustCruiseMul - (drag + dustDrag) * TICK_DT - 1e-6);
  });

  it('drags a racer that enters at cruise down to dust cruise within half a second', () => {
    const { samples } = drift(moving(cruise), ticksIn(0.5), hold(RIGHT), { env: DUST });

    expect(samples.at(-1)?.speed).toBeLessThanOrEqual(cruise * dustCruiseMul + 1e-6);
  });
});

describe('solar wind', () => {
  it('pushes an idle racer along its arrow at windForce', () => {
    const racer = bareDrifter();
    drift(racer, 1, IDLE, { env: { ...VACUUM, wind: DOWN } });

    expect(racer.body.vy).toBeGreaterThan(windForce * TICK_DT - TICK_OF_DRAG);
    expect(racer.body.vx).toBe(0);
  });

  it('carries a racer burning with it over cruise', () => {
    const { samples } = drift(bareDrifter(), ticksIn(2), hold(RIGHT), { env: { ...VACUUM, wind: RIGHT } });

    expect(samples.at(-1)?.speed).toBeGreaterThan(cruise + 20);
  });

  it('is read from the cell under the racer: a current is wind and kelp is dust', () => {
    const { world, player } = driftWorld(['.1..>>..~~..F', '............F']);
    placeOnTile(player, 4, RIVAL_LANE_ROWS);
    const inWind = sampleDriftEnvironment(world, player);
    placeOnTile(player, 8, RIVAL_LANE_ROWS);
    const inDust = sampleDriftEnvironment(world, player);

    expect(inWind).toEqual({ ...VACUUM, wind: RIGHT });
    expect(inDust).toEqual({ ...VACUUM, inDust: true });
  });
});

describe('Easy', () => {
  const OPEN = ['.1..........................F', '............................F'];

  it('multiplies the idle brake by ten, so a racer that lets go at cruise stops within 1.6 s', () => {
    const { world } = driftWorld(OPEN, { difficulty: 'easy' });
    const tuning = effectiveTuning(world);
    const { samples } = drift(moving(cruise), ticksIn(1.6), IDLE, { tuning });

    expect(tuning.extra.idleBrake).toBe(idleBrake * 10);
    expect(samples.at(-1)?.speed).toBe(0);
  });

  it('leaves Normal and Hard coasting on the base numbers', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      const { world } = driftWorld(OPEN, { difficulty });
      expect(effectiveTuning(world).extra, difficulty).toEqual(DRIFT_TUNING.extra);
    }
  });
});

describe('in a race', () => {
  it('leaves a racer a full-strength Tractor Beam pulled back at 0.8 cruise again within 1.2 s of it ending', () => {
    const { world, log, player } = driftWorld([
      '.1........................................F',
      '..........................................F',
    ]);
    placeOnTile(player, 30, RIVAL_LANE_ROWS);
    player.status.undertow = 90;
    player.undertowGapTiles = 99;
    step(world, log, 90, hold(RIGHT));
    const pulledBack = player.body.vx;
    step(world, log, ticksIn(1.2), hold(RIGHT));

    expect(pulledBack).toBeLessThan(0);
    expect(player.body.vx).toBeGreaterThanOrEqual(cruise * 0.8);
  });

  it('moves the player through the world: a burn, then a drift that carries on with the stick idle', () => {
    const { world, log, player } = driftWorld(['.1..........................F', '............................F']);
    step(world, log, ticksIn(1), hold(RIGHT));
    const afterBurn = player.body.x;
    step(world, log, ticksIn(1), IDLE);

    expect(player.body.x - afterBurn).toBeGreaterThan(cruise * 0.7);
    expect(player.body.vx).toBeGreaterThan(cruise * 0.7);
  });

  it('holds a trapped racer still', () => {
    const { world, log, player } = driftWorld(['.1..........................F', '............................F']);
    player.status.trapped = 40;
    const before = { x: player.body.x, y: player.body.y };
    step(world, log, 30, hold(RIGHT));

    expect({ x: player.body.x, y: player.body.y }).toEqual(before);
  });
});

describe('the drift medium', () => {
  it('is shipped, with rules that suit a vacuum', () => {
    const medium = MEDIA.drift;

    expect(medium.racerCollision).toBe('solid');
    expect(medium.effects).toEqual({
      dashAxes: 'both',
      trappedDrift: 0,
      looseDrift: 0,
      stompBounce: null,
      solidClams: false,
      pitBelow: false,
      allowsLedges: false,
      assistAxes: 'both',
      gravityWells: true,
      bounceSpeed: null,
    });
    expect(medium.kickRules).toMatchObject({ dodgesSquid: true, shakesLatch: true, countersUndertow: true });
  });

  it('refuses a tuning that lacks one of its extras, naming it', () => {
    const { cruise: _cruise, ...withoutCruise } = DRIFT_TUNING.extra;
    const tuning = { ...DRIFT_TUNING, extra: withoutCruise };

    expect(() => applyDriftIntent(bareDrifter(), IDLE, VACUUM, tuning, BASE, { emit: () => {} }, TICK_DT)).toThrow(
      /no extra 'cruise'/,
    );
  });
});
