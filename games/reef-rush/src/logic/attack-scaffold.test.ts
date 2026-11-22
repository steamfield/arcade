/**
 * Phase 7 scaffold: the attack power-up contracts exist, but every new module is a no-op, so a race
 * plays exactly as it did on phase 6. The fingerprints below were recorded from the phase 6 code
 * (before these hooks existed); if one changes, a hook is no longer a no-op.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it, vi } from 'vitest';
import { BOT_PROFILES } from './ai/profiles.ts';
import type { GameEvent } from './events.ts';
import { OCEAN_LEVEL } from './level/levels.ts';
import { parseLevel } from './level/parse.ts';
import { rollClam } from './pickups/clams.ts';
import { fireBurst } from './powerups/burst.ts';
import { raceOn, racerOf, step, tileCentre } from './test-world.ts';
import { POWER_UP_KINDS, type PowerUpKind } from './types.ts';
import { createWorld, stepWorld, toAscii } from './world.ts';

const { advanceSquids, advanceRiptides, riptideCurrentAt, advanceDecoys } = vi.hoisted(() => ({
  advanceSquids: vi.fn(),
  advanceRiptides: vi.fn(),
  riptideCurrentAt: vi.fn(() => null),
  advanceDecoys: vi.fn(),
}));
// The hooks are the scaffold's contract, so the tests watch calls to them; each one's body is a no-op.
vi.mock('./hazards/squids.ts', () => ({ advanceSquids }));
vi.mock('./powerups/riptides.ts', () => ({ advanceRiptides, riptideCurrentAt }));
vi.mock('./powerups/decoys.ts', () => ({ advanceDecoys }));

const NEW_KINDS: readonly PowerUpKind[] = ['homingSquid', 'riptide', 'undertow', 'mimic'];

const ARENA = `
  ####################
  #1................F#
  #2................F#
  #3................F#
  #4................F#
  ####################
`;

/** A whole bot-driven stretch of the real course: 2400 ticks with the expert bot as Nib. */
function raceFingerprint(seed: number) {
  const log = new EventLog<GameEvent>(1_000_000);
  const world = createWorld(parseLevel(OCEAN_LEVEL), log, { seed, playerBot: BOT_PROFILES.expert, character: 'nib' });
  const idle = { move: { x: 0, y: 0 }, kick: false, burst: false };
  for (let i = 0; i < 2400; i++) stepWorld(world, idle, TICK_DT);
  const events = log.all();
  return {
    world,
    events,
    racers: world.racers.map((r) => [
      r.id,
      r.character,
      Math.round(r.body.x),
      Math.round(r.body.y),
      r.place,
      r.stack.join('+'),
    ]),
  };
}

describe('a seeded race plays as it did before the attack power-ups', () => {
  const RECORDED = {
    1: {
      racers: [
        ['player', 'nib', 4354, 130, 1, 'glowLantern+inkSac+bubbleShield'],
        ['tess', 'gil', 4225, 125, 3, 'glowLantern'],
        ['squib', 'streak', 4286, 134, 2, 'jetFin'],
        ['bo', 'selene', 4141, 139, 4, ''],
      ],
      eventCount: 196,
    },
    7: {
      racers: [
        ['player', 'nib', 4776, 133, 1, 'jetFin+glowLantern'],
        ['tess', 'rook', 4340, 139, 3, ''],
        ['squib', 'onyx', 4434, 138, 2, 'glowLantern+puffer'],
        ['bo', 'selene', 4278, 129, 4, 'bubbleShield'],
      ],
      eventCount: 186,
    },
    42: {
      racers: [
        ['player', 'nib', 4411, 128, 1, 'glowLantern+bubbleShield+inkSac+jetFin'],
        ['tess', 'onyx', 4084, 128, 4, ''],
        ['squib', 'gil', 4164, 131, 3, ''],
        ['bo', 'streak', 4233, 134, 2, ''],
      ],
      eventCount: 196,
    },
  } as const;

  it.each([1, 7, 42] as const)('seed %i: racers, places, stacks and event count match the recorded race', (seed) => {
    const { racers, events } = raceFingerprint(seed);
    expect({ racers, eventCount: events.length }).toEqual(RECORDED[seed]);
  });

  it('never creates a squid, riptide or decoy and emits none of the new events', () => {
    const { world, events } = raceFingerprint(1);
    expect([world.squids, world.riptides, world.decoys]).toEqual([[], [], []]);
    const attackEvents = events.filter((e) => /^(squid|riptide|undertow|decoy)\.|^racer\.shaken$/.test(e.type));
    expect(attackEvents).toEqual([]);
    expect(world.racers.map((r) => [r.status.latched, r.status.undertow])).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
  });
});

describe('the attack kinds are inert', () => {
  it('lists them after the five original kinds, in contract order', () => {
    expect(POWER_UP_KINDS.slice(5)).toEqual(NEW_KINDS);
  });

  it('never rolls from a clam, for any place', () => {
    const rng = raceOn(ARENA).world.rngs.pickups;
    const rolled = new Set(Array.from({ length: 2000 }, (_, i) => rollClam(rng, (i % 4) + 1, [])));
    expect(NEW_KINDS.filter((kind) => rolled.has(kind))).toEqual([]);
  });

  it('bursting a held attack kind spends the cooldown and spawns nothing', () => {
    const { world } = raceOn(ARENA);
    const player = racerOf(world, 'player');
    player.stack = [...NEW_KINDS];
    const spawned = () =>
      JSON.stringify([world.squids, world.riptides, world.decoys, world.inks, world.bubbles, player.status]);
    const before = spawned();
    expect(fireBurst(world, player, { x: 1, y: 0 })).toBe(true);
    expect(spawned()).toBe(before);
    expect(player.stack).toEqual(NEW_KINDS);
  });
});

describe('the new stepWorld calls', () => {
  it('advanceSquids runs every racing tick with the world, the active racers and dt', () => {
    advanceSquids.mockClear();
    const { world, log } = raceOn(ARENA);
    step(world, log, 3);
    expect(advanceSquids).toHaveBeenCalledTimes(3);
    expect(advanceSquids).toHaveBeenLastCalledWith(world, expect.arrayContaining([racerOf(world, 'player')]), TICK_DT);
  });

  it('advanceRiptides runs every racing tick with the world', () => {
    advanceRiptides.mockClear();
    const { world, log } = raceOn(ARENA);
    step(world, log, 3);
    expect(advanceRiptides).toHaveBeenCalledTimes(3);
    expect(advanceRiptides).toHaveBeenCalledWith(world);
  });

  it('advanceDecoys runs every racing tick with the world and dt', () => {
    advanceDecoys.mockClear();
    const { world, log } = raceOn(ARENA);
    step(world, log, 3);
    expect(advanceDecoys).toHaveBeenCalledTimes(3);
    expect(advanceDecoys).toHaveBeenCalledWith(world, TICK_DT);
  });

  it('riptideCurrentAt is asked about each racer that swims', () => {
    riptideCurrentAt.mockClear();
    const { world, log } = raceOn(ARENA);
    step(world, log, 2);
    expect(riptideCurrentAt).toHaveBeenCalledTimes(8);
    expect(riptideCurrentAt).toHaveBeenCalledWith(world, racerOf(world, 'player').body);
  });

  it('none of them run during the countdown', () => {
    for (const hook of [advanceSquids, advanceRiptides, advanceDecoys, riptideCurrentAt]) hook.mockClear();
    const { world, log } = raceOn(ARENA);
    world.race.phase = 'countdown';
    step(world, log, 2);
    expect([advanceSquids, advanceRiptides, advanceDecoys, riptideCurrentAt].map((h) => h.mock.calls.length)).toEqual([
      0, 0, 0, 0,
    ]);
  });
});

describe('toAscii marks the new things', () => {
  it('shows a squid as s and a decoy as m at the tiles holding their centres', () => {
    const { world } = raceOn(ARENA);
    world.squids.push({ ...tileCentre(8, 3), vx: 0, vy: 0, ttl: 10, owner: 'tess', target: null });
    world.decoys.push({ ...tileCentre(12, 4), vx: 0, vy: 0, ttl: 10, owner: 'bo' });
    const rows = toAscii(world).split('\n');
    expect([rows[3]?.[8], rows[4]?.[12]]).toEqual(['s', 'm']);
  });
});
