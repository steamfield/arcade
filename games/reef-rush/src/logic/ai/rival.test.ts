import { createRng, EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { parseLevel } from '../level/parse.ts';
import type { Intent, Racer, RacerId, TickInput, World } from '../types.ts';
import { createWorld, stepWorld } from '../world.ts';
import { RIVAL_PROFILES } from './profiles.ts';
import { CATCH_UP, catchUpMul, rivalIntent } from './rival.ts';

const IDLE: TickInput = { move: { x: 0, y: 0 }, kick: false, burst: false };

/** One walled lane per racer, so every aim is straight right and nobody bumps. */
function lanes(seed = 1) {
  const level = parseLevel({
    name: 'lanes',
    ascii: `
      ####################
      #1...............F#
      ####################
      #2...............F#
      ####################
      #3...............F#
      ####################
      #4...............F#
      ####################
    `,
  });
  const log = new EventLog<GameEvent>(100_000);
  return { world: createWorld(level, log, { seed }), log };
}

function racer(world: World, id: RacerId): Racer {
  const found = world.racers.find((r) => r.id === id);
  if (!found) throw new Error(`No racer ${id}`);
  return found;
}

/** Skips the countdown so intents are asked for a running race. */
function racing(world: World) {
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null };
}

/** Asks for `ticks` intents, calling `hold` on the racer before each to pin its velocity. */
function intents(world: World, id: 'tess' | 'squib' | 'bo', ticks: number, hold: (r: Racer) => void): Intent[] {
  const target = racer(world, id);
  const out: Intent[] = [];
  for (let i = 0; i < ticks; i++) {
    hold(target);
    out.push(rivalIntent(world, target, world.rngs[`ai.${id}`]));
  }
  return out;
}

const sideways = (intent: Intent) => Math.abs(intent.move.x) < 0.5 && Math.abs(intent.move.y) > 0.8;

describe('rival racing', () => {
  it('swims every rival to the finish of a straight course', () => {
    const { world } = lanes();
    for (let i = 0; i < 1200 && world.racers.some((r) => r.ai && !r.finished); i++) stepWorld(world, IDLE, TICK_DT);

    for (const id of ['tess', 'squib', 'bo'] as const) expect(racer(world, id).finished, id).not.toBeNull();
  });

  it('repeats a race exactly with the same seed', () => {
    const run = () => {
      const { world, log } = lanes(7);
      for (let i = 0; i < 400; i++) {
        log.tick = world.tick;
        stepWorld(world, IDLE, TICK_DT);
      }
      return { racers: world.racers, events: log.all() };
    };

    expect(run()).toEqual(run());
  });

  it('never kicks while its kick is cooling down, and does kick once it is ready', () => {
    const { world } = lanes();
    racing(world);
    const moving = (cooldown: number) => (r: Racer) => {
      r.body.vx = 60;
      r.body.vy = 0;
      r.kickCooldown = cooldown;
    };

    expect(intents(world, 'squib', 200, moving(10)).some((i) => i.kick)).toBe(false);
    expect(intents(world, 'squib', 200, moving(0)).some((i) => i.kick)).toBe(true);
  });

  it('never fires a burst', () => {
    const { world } = lanes();
    racing(world);
    const moving = (r: Racer) => {
      r.body.vx = 60;
    };

    expect(intents(world, 'squib', 300, moving).some((i) => i.burst)).toBe(false);
  });

  it('draws the same amount of randomness whether or not it can kick', () => {
    const { world } = lanes();
    racing(world);
    const tess = racer(world, 'tess');
    const ready = createRng(99);
    const cooling = createRng(99);
    for (let i = 0; i < 50; i++) {
      tess.body.vx = 60;
      tess.kickCooldown = 0;
      rivalIntent(world, tess, ready);
    }
    const second = lanes().world;
    racing(second);
    const tessAgain = racer(second, 'tess');
    for (let i = 0; i < 50; i++) {
      tessAgain.body.vx = 60;
      tessAgain.kickCooldown = 10;
      rivalIntent(second, tessAgain, cooling);
    }

    expect(cooling.state()).toBe(ready.state());
  });

  it('changes nothing in the world but its own memory', () => {
    const { world } = lanes();
    racing(world);
    const tess = racer(world, 'tess');
    const visible = () => ({
      racers: world.racers.map((r) => ({
        ...r,
        body: { ...r.body },
        ai: r.id === 'tess' ? null : structuredClone(r.ai),
      })),
      race: { ...world.race },
      tick: world.tick,
      broken: [...world.broken],
    });
    const before = visible();
    for (let i = 0; i < 50; i++) rivalIntent(world, tess, world.rngs['ai.tess']);

    expect(visible()).toEqual(before);
  });
});

describe('getting unstuck', () => {
  it('swims sideways for 20 ticks once pinned still for 30, well within 60 ticks', () => {
    const { world } = lanes();
    racing(world);
    const pinned = intents(world, 'tess', 90, (r) => {
      r.body.vx = 0;
      r.body.vy = 0;
    });
    const firstSideways = pinned.findIndex(sideways);
    const run = pinned.slice(firstSideways).findIndex((i) => !sideways(i));

    expect(firstSideways).toBeGreaterThanOrEqual(29);
    expect(firstSideways).toBeLessThan(60);
    expect(run).toBe(20);
  });

  it('keeps swimming forward while it is moving', () => {
    const { world } = lanes();
    racing(world);
    const moving = intents(world, 'tess', 120, (r) => {
      r.body.vx = 60;
      r.body.vy = 0;
    });

    const afterFirstRead = moving.slice(RIVAL_PROFILES.tess.reactionTicks);

    expect(moving.some(sideways)).toBe(false);
    expect(afterFirstRead.every((i) => i.move.x > 0.9)).toBe(true);
  });
});

describe('catch-up', () => {
  const pair = (rivalProgress: number, playerProgress: number) => {
    const base = { facing: 1 as const, kickCooldown: 0, place: 1, finished: null, ai: null };
    const body = { x: 0, y: 0, vx: 0, vy: 0, w: 12, h: 10 };
    const rival: Racer = { ...base, id: 'tess', body, progress: rivalProgress, profile: RIVAL_PROFILES.tess };
    const player: Racer = { ...base, id: 'player', body, progress: playerProgress, profile: RIVAL_PROFILES.tess };
    return catchUpMul(rival, player);
  };

  it('slows a rival far ahead of the player down to the lower bound', () => {
    expect(pair(10, 200)).toBeCloseTo(CATCH_UP.min, 6);
  });

  it('speeds a rival far behind the player up to the upper bound', () => {
    expect(pair(200, 10)).toBeCloseTo(CATCH_UP.max, 6);
  });

  it('scales with the gap in between and is neutral when level', () => {
    expect(pair(15, 10)).toBeCloseTo(1 + 5 * CATCH_UP.perTile, 6);
    expect(pair(10, 15)).toBeCloseTo(1 - 5 * CATCH_UP.perTile, 6);
    expect(pair(10, 10)).toBeCloseTo(1, 6);
  });

  it('is neutral before progress is known', () => {
    expect(pair(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)).toBe(1);
  });
});
