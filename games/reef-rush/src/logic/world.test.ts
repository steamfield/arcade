import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from './ai/profiles.ts';
import { DEFAULT_COURSE } from './courses/index.ts';
import type { Course } from './courses/types.ts';
import type { GameEvent } from './events.ts';
import { LevelError } from './level/parse.ts';
import { fireItem } from './powerups/use.ts';
import { COUNTDOWN_TICKS, DNF_GRACE_TICKS, RACE_LIMIT_TICKS, updateProgress } from './race/standings.ts';
import {
  courseFromLevel,
  eventsIn,
  giveItems,
  hold,
  placeAt,
  placeOnTile,
  raceOn,
  racerOf,
  step,
  tileCentre,
} from './test-world.ts';
import { type RacerId, RNG_SALTS, type RngStream, type TickInput, type Vec } from './types.ts';
import { createWorld, stepWorld, summarize, toAscii } from './world.ts';

const IDLE: TickInput = { move: { x: 0, y: 0 }, kick: false, use: false, cycle: 0 };

/** A race on the ocean course with an idle player, stepped up to `ticks` times or until it ends. */
function idleRace(seed: number, ticks: number) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(DEFAULT_COURSE, log, { seed });
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
    const course = courseFromLevel({
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
    const create = () => createWorld(course, new EventLog<GameEvent>(), { seed: 1 });

    expect(create).toThrow(LevelError);
    expect(create).toThrow(expect.objectContaining({ row: 2, col: 1 }));
  });

  it('names every problem the medium finds, located at the first', () => {
    const course = courseFromLevel({
      name: 'two sealed',
      ascii: `
        #########
        #CC....F#
        #1C....F#
        #CC....F#
        #3C....F#
        #CC....F#
        #2..4..F#
        #########
      `,
    });
    const create = () => createWorld(course, new EventLog<GameEvent>(), { seed: 1 });

    expect(create).toThrow(
      expect.objectContaining({
        name: 'LevelError',
        message:
          'Start 1 cannot reach the finish without breaking coral; Start 3 cannot reach the finish without breaking coral',
        row: 2,
        col: 1,
      }),
    );
  });
});

describe('which course a world races', () => {
  const create = (course: Course) => () => createWorld(course, new EventLog<GameEvent>(), { seed: 1 });

  it('refuses a course nobody registered, saying how to register it', () => {
    const stray: Course = { ...DEFAULT_COURSE, id: 'stray-reef' };

    expect(create(stray)).toThrow(
      "Course 'stray-reef' is not the registered course with that id; add it to COURSES or call registerCourse with it",
    );
  });

  it("refuses a copy of a shipped course with another level, instead of racing the shipped course's tuning", () => {
    const altered: Course = { ...DEFAULT_COURSE, level: { name: 'other', ascii: '#1234.F#' } };

    expect(create(altered)).toThrow(`Course '${DEFAULT_COURSE.id}' is not the registered course with that id`);
  });

  it('refuses a registered course whose medium is neither shipped nor registered', () => {
    const course = courseFromLevel('#1234.F#', 'warp');

    expect(create(course)).toThrow(`Course '${course.id}' names unknown medium 'warp'`);
  });
});

describe('finished racers', () => {
  /** One lane, so rivals queue nose to tail and the leader stops against the wall past the line. */
  const queue = () =>
    courseFromLevel({
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
    const owner = new Map<string, string>();
    for (let seed = 1; seed <= 8; seed++) {
      const { rngs } = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(), { seed });
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
  const world = createWorld(DEFAULT_COURSE, log, { seed, playerBot: BOT_PROFILES.expert });
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

describe('downed racers in the step', () => {
  /** A one-tile lane for the player, too narrow to swim round anyone in it; the rest wait in their own lanes. */
  const NARROW = `
    ##############################
    #1..........................F#
    ##############################
    #2..........................F#
    #3..........................F#
    #4..........................F#
    ##############################
  `;

  /** A race in NARROW with Tess stunned in the player's lane at tile 8 and everyone else stunned for good. */
  function stunnedTessAhead() {
    const { world, log } = raceOn(NARROW);
    for (const id of ['squib', 'bo'] as const) racerOf(world, id).status.stunned = 100_000;
    const tess = racerOf(world, 'tess');
    placeOnTile(tess, 8, 1);
    tess.status.stunned = 400;
    return { world, log, player: racerOf(world, 'player'), tess };
  }

  it('keeps a rival whose stun ends inside the player from being shoved out or bumping', () => {
    const { world, log, player, tess } = stunnedTessAhead();
    placeOnTile(player, 8, 1);
    placeAt(tess, { x: tileCentre(8, 1).x + 6, y: tileCentre(8, 1).y });
    tess.status.stunned = 5;
    // Without her AI Tess idles on the test's input like the player, so only a push could move her sideways.
    tess.ai = null;
    const xs = () => [player.body.x, tess.body.x];
    const placed = xs();

    for (let i = 0; i < 20; i++) {
      step(world, log, 1, IDLE);
      expect(xs(), `tick ${world.tick}, stunned ${tess.status.stunned}`).toEqual(placed);
    }

    expect(tess.status.stunned).toBe(0);
    expect(eventsIn(log, 'racer.bumped')).toEqual([]);
  });

  it('lets the player swim through a stunned rival ahead and take its place, never moving it', () => {
    const swimmer = stunnedTessAhead();
    // The same race with the player idle at the start shows where Tess drifts on her own.
    const alone = stunnedTessAhead();
    let passedOn: number | null = null;

    for (let i = 0; i < 300 && passedOn === null; i++) {
      step(swimmer.world, swimmer.log, 1, hold({ x: 1, y: 0 }));
      step(alone.world, alone.log, 1, IDLE);
      expect(swimmer.tess.body, `tick ${swimmer.world.tick}`).toEqual(alone.tess.body);
      if (swimmer.player.body.x > swimmer.tess.body.x + swimmer.tess.body.w) passedOn = swimmer.world.tick;
    }

    expect(passedOn).not.toBeNull();
    expect(swimmer.tess.status.stunned).toBeGreaterThan(0);
    expect([swimmer.player.place, swimmer.tess.place]).toEqual([1, 2]);
    expect(eventsIn(swimmer.log, 'racer.bumped', 'racer.hit')).toEqual([]);
  });
});

describe('finished racers and items', () => {
  it('never gain or lose power-ups, even parked on a clam and an urchin', () => {
    const { world, log } = raceOn(LANES);
    const tess = racerOf(world, 'tess');
    placeAt(tess, { x: 6 * 16, y: tileCentre(5, 3).y });
    tess.finished = { tick: 0, place: 1, overshoot: 0 };
    giveItems(tess, ['jetFin']);

    step(world, log, 300);

    const tessEvents = eventsIn(log).filter((event) => 'id' in event && event.id === 'tess');
    expect(tessEvents).toEqual([]);
    expect(tess.items).toEqual([{ kind: 'jetFin', charges: 3 }, null, null]);
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

  it('counters and the item use cooldown run down one per tick and stop at 0', () => {
    const { world, log } = raceOn(LANES);
    const player = racerOf(world, 'player');
    player.status = { ...player.status, stunned: 5, invulnerable: 5, trapped: 5 };
    player.useCooldown = 5;
    const counters = () => [
      player.status.stunned,
      player.status.invulnerable,
      player.status.trapped,
      player.useCooldown,
    ];

    step(world, log, 3);
    expect(counters()).toEqual([2, 2, 2, 2]);
    step(world, log, 3);
    expect(counters()).toEqual([0, 0, 0, 0]);
  });
});

describe('summary and ASCII', () => {
  it('summarize reports the player items per slot, the selection, pearls and stun', () => {
    const { world } = raceOn(LANES);
    const player = racerOf(world, 'player');
    giveItems(player, ['jetFin', null, { kind: 'puffer', charges: 1 }], 2);
    player.pearls = 2;
    player.status.stunned = 3;

    expect(summarize(world)).toMatchObject({
      items: ['jetFin:3', null, 'puffer:1'],
      selected: 2,
      pearls: 2,
      stunned: true,
    });
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
    giveItems(tess, ['homingSquid']);
    fireItem(world, tess, 0, { x: 1, y: 0 });

    const player = racerOf(world, 'player');
    // Rudy's ability would shorten the latch; Gil's does not touch it, so it runs its full 90 ticks.
    player.character = 'gil';
    // Holding something, so the hit takes it instead of stunning the player, who could not kick through a stun.
    giveItems(player, ['jetFin']);
    for (let i = 0; i < 120 && player.status.latched === 0; i++) step(world, log, 1, IDLE);
    expect(eventsIn(log, 'squid.latched')).toEqual([{ type: 'squid.latched', id: 'player', by: 'tess' }]);
    expect(player.status.latched).toBeGreaterThan(0);

    // Each kick takes 30 ticks off, and the tick's own countdown takes one more.
    const before = player.status.latched;
    step(world, log, 1, hold({ x: 0, y: 0 }, { kick: true }));
    expect(player.status.latched).toBe(before - 31);
    // Kicks are 36 ticks apart, so a second one lands before the rest runs out and shakes it off.
    step(world, log, 36, IDLE);
    step(world, log, 1, hold({ x: 0, y: 0 }, { kick: true }));
    expect(player.status.latched).toBe(0);
    expect(eventsIn(log, 'racer.shaken')).toEqual([{ type: 'racer.shaken', id: 'player' }]);
  });

  it('rivals fire squids at the racer ahead, another rival or the player, without anyone rolling a clam', () => {
    const { world, log } = raceOn(POOL);
    // Tess trails everyone, Squib is between her and the player: Tess's nearest racer ahead is Squib,
    // Squib's is the player.
    placeOnTile(racerOf(world, 'tess'), 3, 2);
    placeOnTile(racerOf(world, 'squib'), 9, 2);
    placeAt(racerOf(world, 'player'), tileCentre(14, 2));
    placeOnTile(racerOf(world, 'bo'), 1, 4);
    updateProgress(world);
    for (const id of ['tess', 'squib'] as const) {
      const rival = racerOf(world, id);
      giveItems(rival, ['homingSquid']);
      rival.profile = { ...rival.profile, itemAggression: 1 };
    }

    step(world, log, 3, IDLE);

    expect(eventsIn(log, 'squid.locked')).toEqual([
      { type: 'squid.locked', owner: 'tess', target: 'squib' },
      { type: 'squid.locked', owner: 'squib', target: 'player' },
    ]);
  });

  it('a racer who crosses the line latched or pulled is let go, and nobody is left latched on the finish', () => {
    const { world, log } = raceOn(POOL);
    const player = racerOf(world, 'player');
    placeAt(player, { x: world.level.finishX * 16 - 2, y: tileCentre(1, 2).y });
    player.body.vx = 120;
    player.status.latched = 50;
    player.status.undertow = 40;

    step(world, log, 3, hold({ x: 1, y: 0 }));

    expect(player.finished).not.toBeNull();
    expect([player.status.latched, player.status.undertow]).toEqual([0, 0]);
  });

  it('empties the water of squids, decoys and riptides when the race ends', () => {
    const { world, log } = raceOn(POOL);
    const player = racerOf(world, 'player');
    placeAt(player, { x: world.level.finishX * 16 - 2, y: tileCentre(1, 2).y });
    player.body.vx = 120;
    world.squids.push({ ...tileCentre(5, 3), vx: 0, vy: 0, ttl: 100, owner: 'tess', target: null });
    world.decoys.push({ ...tileCentre(6, 3), vx: 0, vy: 0, ttl: 100, owner: 'tess' });
    world.riptides.push({ x: 80, y: 40, w: 64, h: 32, dir: { x: 1, y: 0 }, ttl: 100, owner: 'tess' });

    step(world, log, 3, hold({ x: 1, y: 0 }));

    expect(world.race.phase).toBe('finished');
    expect([world.squids, world.decoys, world.riptides]).toEqual([[], [], []]);
  });
});
