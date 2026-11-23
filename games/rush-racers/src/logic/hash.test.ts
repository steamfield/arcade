import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { DEFAULT_COURSE } from './courses/index.ts';
import type { GameEvent } from './events.ts';
import { hashWorld } from './hash.ts';
import { giveItems, hold, IDLE, racerOf } from './test-world.ts';
import type { TickInput, World } from './types.ts';
import { createWorld, stepWorld } from './world.ts';

const RIGHT = hold({ x: 1, y: 0 });

/** A race on the default course, stepped `ticks` times with `input`. */
function raced(ticks: number, input: TickInput = IDLE, seed = 1): World {
  const world = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(100_000), { seed });
  for (let tick = 0; tick < ticks; tick++) stepWorld(world, input, TICK_DT);
  return world;
}

/** Ticks that put the race well past the countdown, with rivals swimming and AI memory in use. */
const MID_RACE = 400;

describe('hashWorld', () => {
  it.each([0, 1, MID_RACE])('is equal for two worlds with the same seed and inputs after %i ticks', (ticks) => {
    expect(hashWorld(raced(ticks, RIGHT))).toBe(hashWorld(raced(ticks, RIGHT)));
  });

  it('is an unsigned 32-bit integer', () => {
    const hash = hashWorld(raced(MID_RACE, RIGHT));

    expect(Number.isInteger(hash)).toBe(true);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xffffffff);
  });

  it('differs when a single tick of input differs', () => {
    const same = raced(MID_RACE, RIGHT);
    const other = raced(MID_RACE - 1, RIGHT);
    stepWorld(other, IDLE, TICK_DT);

    expect(hashWorld(other)).not.toBe(hashWorld(same));
  });

  it('differs between seeds before the first tick', () => {
    expect(hashWorld(raced(0, IDLE, 1))).not.toBe(hashWorld(raced(0, IDLE, 2)));
  });

  const edits: [string, (world: World) => void][] = [
    [
      'a position by a billionth of a pixel',
      (world) => {
        racerOf(world, 'tess').body.x += 1e-9;
      },
    ],
    [
      'a status counter',
      (world) => {
        racerOf(world, 'player').status.stunned += 1;
      },
    ],
    ['a held item', (world) => giveItems(racerOf(world, 'squib'), [{ kind: 'jetFin', charges: 2 }])],
    [
      'a dash charge',
      (world) => {
        racerOf(world, 'player').kickCharges -= 1;
      },
    ],
    ['one draw from the pickups stream', (world) => void world.rngs.pickups.next()],
    ['one draw from a rival stream', (world) => void world.rngs['ai.bo'].next()],
    [
      'a clam timer',
      (world) => {
        (world.clams[0] as World['clams'][number]).closedFor += 1;
      },
    ],
    ['a pearl taken', (world) => void world.pearlsTaken.add(0)],
    [
      'a broken coral tile',
      (world) => {
        (world.broken as Set<number>).add(7);
      },
    ],
    [
      'a loose pearl',
      (world) => void world.loosePearls.push({ at: { x: 8, y: 8 }, vel: { x: 0, y: 0 }, age: 0, droppedBy: null }),
    ],
    [
      'the race clock',
      (world) => {
        world.race.raceTick += 1;
      },
    ],
    [
      'the world tick',
      (world) => {
        world.tick += 1;
      },
    ],
    [
      'a rival memory counter',
      (world) => {
        const memory = racerOf(world, 'tess').ai;
        if (!memory) throw new Error('tess should be AI-driven');
        memory.sinceBest += 1;
      },
    ],
    [
      'a finish',
      (world) => {
        racerOf(world, 'bo').finished = { tick: 1, place: 1, overshoot: 0 };
      },
    ],
    ['a contact pair', (world) => void world.contacts.add('player|tess')],
  ];

  it.each(edits)('differs after changing %s', (_what, edit) => {
    const world = raced(MID_RACE, RIGHT);
    const before = hashWorld(world);

    edit(world);

    expect(hashWorld(world)).not.toBe(before);
  });

  it('tells +0 from -0, since engines that disagree on a sign have already diverged', () => {
    const positive = raced(0);
    const negative = raced(0);
    racerOf(positive, 'player').body.vx = 0;
    racerOf(negative, 'player').body.vx = -0;

    expect(hashWorld(negative)).not.toBe(hashWorld(positive));
  });

  it('tells an absent optional field from one that is set', () => {
    const world = raced(0);
    const before = hashWorld(world);

    racerOf(world, 'player').undertowGapTiles = 0;

    expect(hashWorld(world)).not.toBe(before);
  });

  it('treats a key set to undefined as absent', () => {
    const world = raced(0);
    const before = hashWorld(world);

    racerOf(world, 'player').undertowGapTiles = undefined;

    expect(hashWorld(world)).toBe(before);
  });

  it('is equal for sets with the same members added in a different order', () => {
    const forward = raced(0);
    const backward = raced(0);
    for (const tile of [3, 11, 7]) (forward.broken as Set<number>).add(tile);
    for (const tile of [7, 11, 3]) (backward.broken as Set<number>).add(tile);
    forward.contacts.add('player|tess').add('bo|squib');
    backward.contacts.add('bo|squib').add('player|tess');

    expect(hashWorld(backward)).toBe(hashWorld(forward));
  });

  it('ignores events, which are output and not state', () => {
    const world = raced(MID_RACE, RIGHT);
    const before = hashWorld(world);

    world.events.emit({ type: 'race.started' });

    expect(world.recentEvents.length).toBeGreaterThan(0);
    expect(hashWorld(world)).toBe(before);
  });

  it('does not change the world it reads', () => {
    const world = raced(MID_RACE, RIGHT);
    const twin = raced(MID_RACE, RIGHT);

    hashWorld(world);
    stepWorld(world, RIGHT, TICK_DT);
    stepWorld(twin, RIGHT, TICK_DT);

    expect(hashWorld(world)).toBe(hashWorld(twin));
  });

  it('refuses state that contains itself, naming where it is', () => {
    const world = raced(0);
    const racer = racerOf(world, 'player');
    Object.assign(racer.status, { owner: racer });

    expect(() => hashWorld(world)).toThrow(TypeError);
    expect(() => hashWorld(world)).toThrow(/a cycle at racers\.0\.status\.owner/);
  });

  it('allows one object to appear in two places', () => {
    const world = raced(0);
    const shared = { x: 1, y: 2 };
    Object.assign(racerOf(world, 'player').status, { a: shared, b: shared });

    expect(() => hashWorld(world)).not.toThrow();
  });

  it('refuses state it has no rule for, naming where it is', () => {
    const world = raced(0);
    Object.assign(racerOf(world, 'player').status, { onHit: () => {} });

    expect(() => hashWorld(world)).toThrow(TypeError);
    expect(() => hashWorld(world)).toThrow(/racers\.0\.status\.onHit/);
  });
});
