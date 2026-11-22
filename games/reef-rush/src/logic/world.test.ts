import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from './ai/profiles.ts';
import type { GameEvent } from './events.ts';
import { OCEAN_LEVEL } from './level/levels.ts';
import { LevelError, parseLevel } from './level/parse.ts';
import { fireBurst } from './powerups/burst.ts';
import { COUNTDOWN_TICKS, DNF_GRACE_TICKS, RACE_LIMIT_TICKS } from './race/standings.ts';
import { eventsIn, hold, placeAt, placeOnTile, raceOn, racerOf, step, tileCentre } from './test-world.ts';
import { type RacerId, RNG_SALTS, type RngStream, type TickInput, type Vec } from './types.ts';
import { createWorld, stepWorld, summarize, toAscii } from './world.ts';

const IDLE: TickInput = { move: { x: 0, y: 0 }, kick: false, burst: false };

/** A race on the ocean course with an idle player, stepped up to `ticks` times or until it ends. */
function idleRace(seed: number, ticks: number) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(parseLevel(OCEAN_LEVEL), log, { seed });
  for (let i = 0; i < ticks && world.race.phase !== 'finished'; i++) {
    log.tick = world.tick;
    stepWorld(world, IDLE, TICK_DT);
  }
  return { world, log };
}

describe('a full race', () => {
  it('ends by DNF for an idle player once all three rivals have finished', () => {
    const { world, log } = idleRace(1, COUNTDOWN_TICKS + RACE_LIMIT_TICKS + 1);
    const rivals = world.racers.filter((r) => r.id !== 'player');

    expect(world.race.phase).toBe('finished');
    expect(rivals.every((r) => r.finished !== null)).toBe(true);
    expect(world.race.raceTick).toBe((world.race.rivalsDoneAt ?? Number.NaN) + DNF_GRACE_TICKS);
    expect(world.race.result).toMatchObject({ playerPlace: 4, playerTicks: null });
    expect(world.race.result?.standings.at(-1)).toBe('player');
    expect(log.all().filter((e) => e.type === 'racer.finished')).toHaveLength(3);
    expect(log.all().filter((e) => e.type === 'race.finished')).toMatchObject([
      { type: 'race.finished', ...world.race.result },
    ]);
  });
});

describe('determinism', () => {
  it('repeats the same event stream for the same seed', () => {
    expect(idleRace(3, 1200).log.all()).toEqual(idleRace(3, 1200).log.all());
  });

  it('plays out differently for a different seed', () => {
    expect(idleRace(3, 1200).log.all()).not.toEqual(idleRace(4, 1200).log.all());
  });
});

describe('level checks', () => {
  it('refuses a level whose player start is walled in by coral, naming the start tile', () => {
    const level = parseLevel({
      name: 'sealed',
      ascii: `
        ########
        #CC...F#
        #1C...F#
        #CC...F#
        #2.3.4F#
        ########
      `,
    });
    const create = () => createWorld(level, new EventLog<GameEvent>(), { seed: 1 });

    expect(create).toThrow(LevelError);
    expect(create).toThrow(expect.objectContaining({ row: 2, col: 1 }));
  });
});

describe('finished racers', () => {
  /** One lane, so rivals queue nose to tail and the leader stops against the wall past the line. */
  const queue = () =>
    parseLevel({
      name: 'queue',
      ascii: `
        ############
        #1234....F.#
        ############
      `,
    });

  it('stay where they crossed the line and never bump anyone', () => {
    const log = new EventLog<GameEvent>(100_000);
    const world = createWorld(queue(), log, { seed: 1 });
    const parked = new Map<RacerId, Vec>();
    const bumpsWithFinished: string[] = [];
    let cursor = 0;
    while (world.race.phase !== 'finished' && world.tick < 3000) {
      log.tick = world.tick;
      stepWorld(world, IDLE, TICK_DT);
      const drained = log.drain(cursor);
      cursor = drained.cursor;
      for (const event of drained.events) {
        if (event.type !== 'racer.bumped' || !(parked.has(event.a) || parked.has(event.b))) continue;
        bumpsWithFinished.push(`${event.a}|${event.b} on tick ${event.tick}`);
      }
      for (const racer of world.racers) {
        const at = parked.get(racer.id);
        const now = { x: racer.body.x, y: racer.body.y };
        if (at) expect(now, `${racer.id} on tick ${world.tick}`).toEqual(at);
        else if (racer.finished) parked.set(racer.id, now);
      }
    }

    expect([...parked.keys()].sort()).toEqual(['bo', 'squib', 'tess']);
    expect(bumpsWithFinished).toEqual([]);
  });
});

describe('random streams', () => {
  it('never repeat another stream or another seed', () => {
    const level = parseLevel(OCEAN_LEVEL);
    const owner = new Map<string, string>();
    for (let seed = 1; seed <= 8; seed++) {
      const { rngs } = createWorld(level, new EventLog<GameEvent>(), { seed });
      for (const stream of Object.keys(RNG_SALTS) as RngStream[]) {
        const draws = Array.from({ length: 4 }, () => rngs[stream].next()).join(',');
        expect(owner.get(draws), `${stream} at seed ${seed}`).toBeUndefined();
        owner.set(draws, `${stream} at seed ${seed}`);
      }
    }
  });
});

/** A full race on the ocean course with the expert bot driving the player, items and all. */
function expertRace(seed: number) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(parseLevel(OCEAN_LEVEL), log, { seed, playerBot: BOT_PROFILES.expert });
  while (world.race.phase !== 'finished' && world.tick <= COUNTDOWN_TICKS + RACE_LIMIT_TICKS) {
    log.tick = world.tick;
    stepWorld(world, IDLE, TICK_DT);
  }
  return { world, log };
}

describe('races with power-ups', () => {
  it('still end with the expert bot finishing', () => {
    const { world } = expertRace(2);

    expect(world.race.phase).toBe('finished');
    expect(world.racers.find((r) => r.id === 'player')?.finished).not.toBeNull();
  });

  it('repeat exactly with the same seed', () => {
    expect(expertRace(5).log.all()).toEqual(expertRace(5).log.all());
  });

  it('run pickups and hazards inside the step: a pearl, then a clam, then an urchin', () => {
    const { world, log } = raceOn(`
      ####################
      #1.o.?.*..........F#
      ####################
      #2................F#
      ####################
      #3................F#
      ####################
      #4................F#
      ####################
    `);

    step(world, log, 120, hold({ x: 1, y: 0 }));
    const types = eventsIn(log, 'pearl.collected', 'clam.opened', 'racer.hit').map((event) => event.type);

    expect(types.slice(0, 3)).toEqual(['pearl.collected', 'clam.opened', 'racer.hit']);
  });
});

/** One walled lane per racer, so nothing but the test's own setup touches anyone. */
const LANES = `
  ####################
  #1................F#
  ####################
  #2...?*...........F#
  ####################
  #3................F#
  ####################
  #4................F#
  ####################
`;

describe('finished racers and items', () => {
  it('never gain or lose power-ups, even parked on a clam and an urchin', () => {
    const { world, log } = raceOn(LANES);
    const tess = racerOf(world, 'tess');
    placeAt(tess, { x: 6 * 16, y: tileCentre(5, 3).y });
    tess.finished = { tick: 0, place: 1, overshoot: 0 };
    tess.stack = ['jetFin'];

    step(world, log, 300);

    const tessEvents = eventsIn(log).filter((event) => 'id' in event && event.id === 'tess');
    expect(tessEvents).toEqual([]);
    expect(tess.stack).toEqual(['jetFin']);
    expect(world.clams[0]?.closedFor).toBe(0);
  });
});

describe('statuses in the step', () => {
  it('a stunned racer ignores its input', () => {
    const { world, log } = raceOn(LANES);
    const player = racerOf(world, 'player');
    player.status.stunned = 30;

    step(world, log, 1, hold({ x: 1, y: 0 }, { kick: true }));

    expect(player.body.vx).toBe(0);
    expect(eventsIn(log, 'racer.kicked')).toEqual([]);
  });

  it('a trapped racer floats straight up at 30 px/s whatever it presses', () => {
    const { world, log } = raceOn(LANES);
    const player = racerOf(world, 'player');
    const y = player.body.y;
    player.status.trapped = 30;

    step(world, log, 1, hold({ x: 1, y: 1 }, { kick: true }));

    expect(player.body.vx).toBe(0);
    expect(player.body.vy).toBe(-30);
    expect(player.body.y).toBeCloseTo(y - 0.5, 6);
    expect(eventsIn(log, 'racer.kicked')).toEqual([]);
  });

  it('counters and the burst cooldown run down one per tick and stop at 0', () => {
    const { world, log } = raceOn(LANES);
    const player = racerOf(world, 'player');
    player.status = { ...player.status, stunned: 5, invulnerable: 5, trapped: 5 };
    player.burstCooldown = 5;
    const counters = () => [
      player.status.stunned,
      player.status.invulnerable,
      player.status.trapped,
      player.burstCooldown,
    ];

    step(world, log, 3);
    expect(counters()).toEqual([2, 2, 2, 2]);
    step(world, log, 3);
    expect(counters()).toEqual([0, 0, 0, 0]);
  });
});

describe('summary and ASCII', () => {
  it('summarize reports the player stack, pearls and stun', () => {
    const { world } = raceOn(LANES);
    const player = racerOf(world, 'player');
    player.stack = ['jetFin', 'puffer'];
    player.pearls = 2;
    player.status.stunned = 3;

    expect(summarize(world)).toMatchObject({ stack: ['jetFin', 'puffer'], pearls: 2, stunned: true });
  });

  it('toAscii shows ready and shut clams, pearls in play, urchins and jellies', () => {
    const { world } = raceOn(`
      ##########
      #1.?o*j.F#
      #2......F#
      #3......F#
      #4......F#
      ##########
    `);
    const row = () => toAscii(world).split('\n')[1];

    expect(row()).toBe('#@.?o*j.F#');
    world.pearlsTaken.add(0);
    world.clams = world.clams.map((clam) => ({ ...clam, closedFor: 10 }));
    expect(row()).toBe('#@._.*j.F#');
  });

  it('toAscii shows a squid as s and a decoy as m at the tiles holding their centres', () => {
    const { world } = raceOn(LANES);
    world.squids.push({ ...tileCentre(8, 1), vx: 0, vy: 0, ttl: 10, owner: 'tess', target: null });
    world.decoys.push({ ...tileCentre(12, 2), vx: 0, vy: 0, ttl: 10, owner: 'bo' });
    const rows = toAscii(world).split('\n');

    expect([rows[1]?.[8], rows[2]?.[12]]).toEqual(['s', 'm']);
  });
});

/** Open water long enough for a squid to run down a racer, finish at the right edge. */
const POOL = `
  ###############################
  #1............................#
  #2............................#
  #3............................#
  #4...........................F#
  ###############################
`;

describe('attack power-ups in the step', () => {
  it('a squid fired by a rival latches the player, and kicks shake it off', () => {
    const { world, log } = raceOn(POOL);
    for (const id of ['squib', 'bo'] as const) racerOf(world, id).status.stunned = 100_000;
    const tess = racerOf(world, 'tess');
    tess.status.stunned = 100_000;
    placeOnTile(tess, 3, 2);
    placeAt(racerOf(world, 'player'), tileCentre(12, 2));
    tess.stack = ['homingSquid'];
    fireBurst(world, tess, { x: 1, y: 0 });

    const player = racerOf(world, 'player');
    // Holding something, so the hit takes it instead of stunning the player, who could not kick through a stun.
    player.stack = ['jetFin'];
    for (let i = 0; i < 120 && player.status.latched === 0; i++) step(world, log, 1, IDLE);
    expect(eventsIn(log, 'squid.latched')).toEqual([{ type: 'squid.latched', id: 'player', by: 'tess' }]);
    expect(player.status.latched).toBeGreaterThan(0);

    // Kicks 36 ticks apart take 30 off each, so three shake off a 150-tick latch long before it runs out.
    for (let kick = 0; kick < 3; kick++) {
      step(world, log, 1, hold({ x: 0, y: 0 }, { kick: true }));
      step(world, log, 36, IDLE);
    }
    expect(player.status.latched).toBe(0);
    expect(eventsIn(log, 'racer.shaken')).toEqual([{ type: 'racer.shaken', id: 'player' }]);
  });

  it('rivals fire squids at each other and at the player over whole races', () => {
    const squidsBy = new Set<string>();
    const targets = new Set<string>();
    // Seeds in which rivals do fire squids; most races have none, because only trailers roll them.
    for (const seed of [14, 37]) {
      const log = new EventLog<GameEvent>(1_000_000);
      const world = createWorld(parseLevel(OCEAN_LEVEL), log, { seed, playerBot: BOT_PROFILES.expert });
      for (let i = 0; i < 9000 && world.race.phase !== 'finished'; i++) stepWorld(world, IDLE, TICK_DT);
      for (const event of log.all()) {
        if (event.type === 'squid.spawned') squidsBy.add(event.owner);
        if (event.type === 'squid.locked') targets.add(event.target);
      }
    }

    expect([...squidsBy].some((owner) => owner !== 'player')).toBe(true);
    expect(targets.has('player')).toBe(true);
    expect([...targets].some((target) => target !== 'player' && target !== 'decoy')).toBe(true);
  });
});
