import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { downhillPath, openTiles } from '../ai/steer.ts';
import { DEFAULT_COURSE, levelOf } from '../courses/index.ts';
import { swimNav } from '../media/swim/data.ts';
import { spawnDecoy } from '../powerups/decoys.ts';
import { SQUID } from '../powerups/tuning.ts';
import { fireItem } from '../powerups/use.ts';
import { updateProgress } from '../race/standings.ts';
import { activeRacers, centreOf } from '../racers.ts';
import { eventsIn, giveItems, hold, placeAt, placeOnTile, raceOn, racerOf, step, tileCentre } from '../test-world.ts';
import type { RacerId, Vec, World } from '../types.ts';
import { advanceSquids } from './squids.ts';

/** Open water, all four racers on the left edge and the finish on the right. */
const ARENA = `
  ###############################
  #1...........................F#
  #2...........................F#
  #3...........................F#
  #4...........................F#
  ###############################
`;

/** A wall at column 10 with a way round below it: a squid from the left reaches the right only by going down and back. */
const WALL = `
  ######################
  #1........#..........#
  #2........#.........F#
  #3........#..........#
  #4..................F#
  #...................F#
  ######################
`;

const RIGHT: Vec = { x: 1, y: 0 };

/** Throws with `message`: for a lookup the test has already made sure succeeds. */
function fail(message: string): never {
  throw new Error(message);
}

/** The world's only squid. */
function squidOf(world: World) {
  return world.squids[0] ?? fail('the world has no squid');
}

/** The world's only decoy. */
function decoyOf(world: World) {
  return world.decoys[0] ?? fail('the world has no decoy');
}

type Spots = Partial<Record<RacerId, [number, number]>>;

/** A race on `ascii` with racers on `spots` (the rest stay on their start tiles) and progress read. */
function scene(spots: Spots, ascii = ARENA) {
  const { world, log } = raceOn(ascii);
  for (const [id, [tx, ty]] of Object.entries(spots) as [RacerId, [number, number]][]) {
    placeOnTile(racerOf(world, id), tx, ty);
  }
  updateProgress(world);
  /** Fires the owner's squid along `aim` from a fresh one-charge Homing Squid in its first slot. */
  const fire = (owner: RacerId, aim: Vec = RIGHT) => {
    giveItems(racerOf(world, owner), ['homingSquid']);
    racerOf(world, owner).useCooldown = 0;
    fireItem(world, racerOf(world, owner), 0, aim);
  };
  /** Advances only the squids, so nobody swims: the racers stay where the test put them. */
  const fly = (ticks = 1) => {
    for (let i = 0; i < ticks; i++) {
      world.recentEvents.splice(0);
      advanceSquids(world, activeRacers(world), TICK_DT);
    }
  };
  return { world, log, fire, fly };
}

const events = (log: ReturnType<typeof raceOn>['log'], ...types: Parameters<typeof eventsIn>[1][]) =>
  eventsIn(log, ...types);

describe('launching a squid', () => {
  it('locks the nearest racer ahead of its owner within 10 tiles', () => {
    const { log, fire } = scene({ player: [3, 2], tess: [10, 2], squib: [8, 3], bo: [2, 2] });

    fire('player');

    expect(events(log, 'squid.spawned', 'squid.locked')).toEqual([
      { type: 'squid.spawned', owner: 'player', target: 'squib' },
      { type: 'squid.locked', owner: 'player', target: 'squib' },
    ]);
  });

  it('passes over a fallen racer for the next nearest one ahead', () => {
    const { world, log, fire } = scene({ player: [3, 2], tess: [10, 2], squib: [8, 3], bo: [2, 2] });
    racerOf(world, 'squib').status.fallen = 30;

    fire('player');

    expect(events(log, 'squid.spawned', 'squid.locked')).toEqual([
      { type: 'squid.spawned', owner: 'player', target: 'tess' },
      { type: 'squid.locked', owner: 'player', target: 'tess' },
    ]);
  });

  it('ignores racers behind its owner, finished racers and racers beyond 10 tiles', () => {
    const { world, log, fire } = scene({ player: [10, 2], tess: [5, 2], squib: [14, 3], bo: [25, 2] });
    racerOf(world, 'squib').finished = { tick: 1, place: 1, overshoot: 0 };

    fire('player');

    expect(events(log, 'squid.spawned', 'squid.locked')).toEqual([
      { type: 'squid.spawned', owner: 'player', target: null },
    ]);
    expect(world.squids).toHaveLength(1);
  });

  it('swims straight along the aim when nobody is in reach, at 160 px/s from its owner', () => {
    const { world, fire } = scene({ player: [3, 2], tess: [1, 2], squib: [1, 3], bo: [1, 4] });

    fire('player', { x: 0, y: 1 });

    expect(world.squids[0]).toMatchObject({ ...centreOf(racerOf(world, 'player')), vx: 0, vy: 160, target: null });
  });

  it('is not locked from the usual range onto a racer with a Mimic Octopus selected: only from half of it', () => {
    const far = scene({ player: [3, 2], tess: [11, 2] });
    giveItems(racerOf(far.world, 'tess'), ['mimic']);
    const near = scene({ player: [3, 2], tess: [7, 2] });
    giveItems(racerOf(near.world, 'tess'), ['mimic']);

    far.fire('player');
    near.fire('player');

    expect(far.world.squids[0]?.target).toBeNull();
    expect(near.world.squids[0]?.target).toEqual({ kind: 'racer', id: 'tess' });
  });
});

describe('a squid on its way', () => {
  it('latches its target: a hit by the owner, the latch status, and the squid is spent', () => {
    const { world, log, fire, fly } = scene({ player: [3, 2], tess: [12, 2] });
    fire('player');

    fly(80);

    expect(events(log, 'squid.latched', 'racer.hit', 'squid.lost')).toEqual([
      { type: 'racer.hit', id: 'tess', cause: 'squid', by: 'player' },
      { type: 'squid.latched', id: 'tess', by: 'player' },
    ]);
    expect(racerOf(world, 'tess').status.latched).toBe(SQUID.latchedTicks);
    expect(world.squids).toEqual([]);
  });

  it('knocks the selected item off its target, or stuns one holding none', () => {
    const holding = scene({ player: [3, 2], tess: [12, 2] });
    giveItems(racerOf(holding.world, 'tess'), ['jetFin', 'puffer'], 1);
    const empty = scene({ player: [3, 2], tess: [12, 2] });
    holding.fire('player');
    empty.fire('player');

    holding.fly(80);
    empty.fly(80);

    expect(racerOf(holding.world, 'tess').items).toEqual([{ kind: 'jetFin', charges: 3 }, null, null]);
    expect(holding.world.loose.map((loose) => loose.kind)).toEqual(['puffer']);
    expect(racerOf(empty.world, 'tess').status.stunned).toBe(50);
  });

  it('is absorbed by a Bubble Shield: no latch, the shield pops, the squid is lost', () => {
    const { world, log, fire, fly } = scene({ player: [3, 2], tess: [12, 2] });
    giveItems(racerOf(world, 'tess'), ['bubbleShield', 'jetFin'], 1);
    fire('player');

    fly(80);

    expect(events(log, 'shield.popped', 'squid.latched', 'squid.lost')).toEqual([
      { type: 'shield.popped', id: 'tess' },
      { type: 'squid.lost', owner: 'player' },
    ]);
    expect(racerOf(world, 'tess').items).toEqual([null, { kind: 'jetFin', charges: 3 }, null]);
    expect(racerOf(world, 'tess').status.latched).toBe(0);
  });

  it('flies through a racer that is invulnerable, dropping the lock and never turning back for it', () => {
    const { world, log, fire, fly } = scene({ player: [3, 2], tess: [12, 2] });
    racerOf(world, 'tess').status.invulnerable = 30;
    fire('player');

    // About 55 ticks bring it to the target; stop just after it has passed through.
    fly(56);
    expect(events(log, 'squid.latched', 'racer.hit')).toEqual([]);
    expect(world.squids).toHaveLength(1);
    expect(world.squids[0]).toMatchObject({ target: null, dodgedBy: 'tess' });

    racerOf(world, 'tess').status.invulnerable = 0;
    fly(10);

    expect(events(log, 'squid.latched')).toEqual([]);
  });

  it('is not lost at launch when it starts inside an ink cloud, only once it has flown on', () => {
    const { world, log, fire, fly } = scene({ player: [3, 2], tess: [20, 2] });
    world.inks = [{ ...tileCentre(3, 2), radius: 16, ttl: 240, owner: 'bo' }];
    fire('player');

    fly(5);
    expect(world.squids).toHaveLength(1);
    expect(events(log, 'squid.lost')).toEqual([]);

    // Past its first ticks the same squid does lose its lock in ink.
    fly(10);
    const { x, y } = squidOf(world);
    world.inks = [{ x, y, radius: 16, ttl: 240, owner: 'bo' }];
    fly(1);
    expect(events(log, 'squid.lost')).toEqual([{ type: 'squid.lost', owner: 'player' }]);
  });

  it('latches Rudy for 40% as long, his ability applying to the latch too', () => {
    const { world, fire, fly } = scene({ player: [3, 2], tess: [12, 2], squib: [12, 3] });
    racerOf(world, 'tess').character = 'rudy';
    fire('player');

    fly(80);

    expect(racerOf(world, 'tess').status.latched).toBe(Math.round(SQUID.latchedTicks * 0.4));
  });

  it('never hits its own owner', () => {
    const { world, log, fire, fly } = scene({ player: [3, 2], tess: [1, 2], squib: [1, 3], bo: [1, 4] });
    fire('player');

    fly(5);

    expect(events(log, 'racer.hit')).toEqual([]);
    expect(racerOf(world, 'player').status.latched).toBe(0);
  });

  it('loses its lock in ink, whoever laid it', () => {
    const { world, log, fire, fly } = scene({ player: [3, 2], tess: [14, 2] });
    world.inks = [{ ...tileCentre(8, 2), radius: 16, ttl: 240, owner: 'bo' }];
    fire('player');

    fly(80);

    expect(events(log, 'squid.latched')).toEqual([]);
    expect(events(log, 'squid.lost')).toEqual([{ type: 'squid.lost', owner: 'player' }]);
    expect(world.squids).toEqual([]);
  });

  it('is lost against a wall', () => {
    const { world, log, fire, fly } = scene({ player: [3, 2], tess: [1, 2], squib: [1, 3], bo: [1, 4] });
    fire('player', { x: 0, y: -1 });

    fly(30);

    expect(events(log, 'squid.lost')).toEqual([{ type: 'squid.lost', owner: 'player' }]);
    expect(world.squids).toEqual([]);
  });

  it('gives up after 360 ticks', () => {
    const { world, log, fire, fly } = scene({ player: [1, 2], tess: [1, 3], squib: [1, 4], bo: [1, 1] });
    // Circles in place with nothing to chase: a squid fired into a corridor wall would die early, so aim along row 2.
    fire('player', RIGHT);
    Object.assign(squidOf(world), { vx: 0, vy: 0 });

    fly(359);
    expect(world.squids).toHaveLength(1);
    fly(1);

    expect(events(log, 'squid.lost')).toEqual([{ type: 'squid.lost', owner: 'player' }]);
  });

  it('retargets the next racer ahead when its target finishes, announcing the new lock', () => {
    const { world, log, fire, fly } = scene({ player: [3, 2], tess: [10, 2], squib: [10, 3] });
    fire('player');
    expect(events(log, 'squid.locked')).toEqual([{ type: 'squid.locked', owner: 'player', target: 'tess' }]);
    racerOf(world, 'tess').finished = { tick: 1, place: 1, overshoot: 0 };

    fly(1);

    expect(events(log, 'squid.locked').at(-1)).toEqual({ type: 'squid.locked', owner: 'player', target: 'squib' });
    expect(world.squids[0]?.target).toEqual({ kind: 'racer', id: 'squib' });
  });

  it('steers round a wall to reach a target it cannot see', () => {
    const { world, log, fire, fly } = scene({ player: [7, 1], tess: [14, 1] }, WALL);
    fire('player');

    fly(360);

    expect(events(log, 'squid.latched')).toEqual([{ type: 'squid.latched', id: 'tess', by: 'player' }]);
    expect(world.squids).toEqual([]);
  });
});

describe('decoys and squids', () => {
  it('prefers a decoy that is at least as near as its racer target, and pops it', () => {
    const { world, log, fire, fly } = scene({ player: [3, 2], tess: [12, 2], squib: [1, 3], bo: [1, 4] });
    spawnDecoy(world, racerOf(world, 'tess'));
    placeAt(racerOf(world, 'tess'), tileCentre(13, 2));
    Object.assign(decoyOf(world), tileCentre(9, 2));
    updateProgress(world);
    fire('player');

    fly(60);

    expect(events(log, 'squid.locked')).toEqual([{ type: 'squid.locked', owner: 'player', target: 'decoy' }]);
    expect(events(log, 'decoy.popped')).toEqual([{ type: 'decoy.popped', owner: 'tess', by: 'player' }]);
    expect(events(log, 'squid.latched')).toEqual([]);
    expect(racerOf(world, 'tess').status.latched).toBe(0);
    expect(world.squids).toEqual([]);
  });

  it('keeps its racer when the decoy is further away', () => {
    const { world, log, fire } = scene({ player: [3, 2], tess: [8, 2], squib: [1, 3], bo: [1, 4] });
    spawnDecoy(world, racerOf(world, 'tess'));
    Object.assign(decoyOf(world), tileCentre(12, 2));
    updateProgress(world);

    fire('player');

    expect(events(log, 'squid.locked')).toEqual([{ type: 'squid.locked', owner: 'player', target: 'tess' }]);
  });
});

/** Distance in px between a squid and a racer's centre. */
function gap(world: World, id: RacerId): number {
  const squid = world.squids[0];
  const target = centreOf(racerOf(world, id));
  return squid ? Math.hypot(target.x - squid.x, target.y - squid.y) : Number.POSITIVE_INFINITY;
}

/** Tess fires a squid at the player while everyone else is held still, then the world runs until it is `within` px away. */
function squidClosingOnPlayer(within: number) {
  const { world, log } = raceOn(ARENA);
  for (const id of ['tess', 'squib', 'bo'] as const) racerOf(world, id).status.stunned = 100_000;
  placeOnTile(racerOf(world, 'tess'), 4, 2);
  placeOnTile(racerOf(world, 'player'), 14, 2);
  updateProgress(world);
  giveItems(racerOf(world, 'tess'), ['homingSquid']);
  fireItem(world, racerOf(world, 'tess'), 0, RIGHT);
  // Nobody moves but the squid and the player, who sinks slowly and so stays on its row.
  for (let tick = 0; gap(world, 'player') > within; tick++) {
    if (tick >= 200) throw new Error(`The squid never came within ${within} px of the player in 200 ticks`);
    step(world, log);
  }
  return { world, log };
}

/** ARENA with a shark at (8, 2), between the player's row-2 spot and a target further on. */
const SHARK_IN_LINE = `
  ###############################
  #1...........................F#
  #2......S....................F#
  #3...........................F#
  #4...........................F#
  ###############################
`;

describe('squids and sharks', () => {
  it('knocks a live shark out in one touch, bursting its pearls, and is spent on it', () => {
    const { world, log, fire, fly } = scene({ player: [3, 2], tess: [12, 2] }, SHARK_IN_LINE);
    fire('player');

    fly(40);

    expect(events(log, 'enemy.defeated', 'pearls.burst', 'squid.lost', 'squid.latched')).toEqual([
      { type: 'enemy.defeated', index: 0, kind: 'shark', by: 'player' },
      { type: 'pearls.burst', index: 0, count: 5 },
      { type: 'squid.lost', owner: 'player' },
    ]);
    expect(world.enemies[0]).toMatchObject({ mode: 'defeated', hp: 0 });
    expect(world.squids).toEqual([]);
  });

  it('flies on past a defeated shark to its target', () => {
    const { world, log, fire, fly } = scene({ player: [3, 2], tess: [12, 2] }, SHARK_IN_LINE);
    Object.assign(world.enemies[0] ?? fail('no shark'), { mode: 'defeated', hp: 0 });
    fire('player');

    fly(80);

    expect(events(log, 'enemy.defeated', 'squid.latched')).toEqual([
      { type: 'squid.latched', id: 'tess', by: 'player' },
    ]);
  });
});

describe('dodging', () => {
  it('a kick in the last 12 ticks before contact makes it miss and fly on', () => {
    const { world, log } = squidClosingOnPlayer(30);

    step(world, log, 1, hold({ x: 0, y: 0 }, { kick: true }));
    step(world, log, 40);

    expect(eventsIn(log, 'squid.dodged')).toEqual([{ type: 'squid.dodged', id: 'player' }]);
    expect(eventsIn(log, 'squid.latched', 'racer.hit')).toEqual([]);
    expect(racerOf(world, 'player').status.latched).toBe(0);
    expect(world.squids[0]).toMatchObject({ target: null, dodgedBy: 'player' });
  });

  it('never locks the racer that dodged it again', () => {
    const { world, log } = squidClosingOnPlayer(30);

    step(world, log, 1, hold({ x: 0, y: 0 }, { kick: true }));
    step(world, log, 120);

    expect(eventsIn(log, 'squid.locked')).toEqual([{ type: 'squid.locked', owner: 'tess', target: 'player' }]);
    expect(eventsIn(log, 'squid.latched')).toEqual([]);
  });

  it('a kick too early does not dodge it', () => {
    const { world, log } = squidClosingOnPlayer(80);

    step(world, log, 1, hold({ x: 0, y: 0 }, { kick: true }));
    step(world, log, 60);

    expect(eventsIn(log, 'squid.dodged')).toEqual([]);
    expect(eventsIn(log, 'squid.latched')).toEqual([{ type: 'squid.latched', id: 'player', by: 'tess' }]);
    expect(racerOf(world, 'player').status.latched).toBeGreaterThan(0);
  });

  it('is not dodged without a kick', () => {
    const { log, world } = squidClosingOnPlayer(30);

    step(world, log, 20);

    expect(eventsIn(log, 'squid.dodged')).toEqual([]);
    expect(eventsIn(log, 'squid.latched')).toHaveLength(1);
  });
});

/**
 * The squid has to find its way round the rock on the real course. For positions along the way a
 * racer swims (the steer field from the first start, every 10 steps), a squid fired from one spot
 * with the target 6 steps further on must latch it: stationary targets, and the squid steered only
 * by its own rules.
 */
describe('on the ocean course', () => {
  it('reaches a target from every stretch of the course', () => {
    const level = levelOf(DEFAULT_COURSE);
    const { world, log } = raceOn(DEFAULT_COURSE.level.ascii);
    const [player, tess] = [racerOf(world, 'player'), racerOf(world, 'tess')];
    // A shark in the way takes the squid; this is about finding a way round rock.
    world.enemies = [];
    const start = level.starts[0] ?? fail('the ocean course has no first start');
    const nav = swimNav(world.nav);
    const path = downhillPath(nav.steer, nav, openTiles(level, world.broken, false), start, 2000);
    const missed: string[] = [];
    let pairs = 0;
    for (let i = 20; i + 6 < path.length; i += 3) {
      const owner = path[i] ?? fail(`no path step ${i}`);
      const target = path[i + 6] ?? fail(`no path step ${i + 6}`);
      placeOnTile(player, owner.x, owner.y);
      placeOnTile(tess, target.x, target.y);
      updateProgress(world);
      // Where the course doubles back on itself a target can sit further from the finish than its
      // owner, and a squid only locks racers ahead; those pairs have nothing to test.
      if (!(tess.progress < player.progress)) continue;
      pairs++;
      tess.status.invulnerable = 0;
      giveItems(player, ['homingSquid']);
      player.useCooldown = 0;
      world.squids = [];
      const latchedBefore = eventsIn(log, 'squid.latched').length;
      fireItem(world, player, 0, RIGHT);
      for (let tick = 0; tick < 360 && world.squids.length > 0; tick++) {
        world.recentEvents.splice(0);
        advanceSquids(world, activeRacers(world), TICK_DT);
      }
      if (eventsIn(log, 'squid.latched').length === latchedBefore) {
        missed.push(`from (${owner.x}, ${owner.y}) to (${target.x}, ${target.y})`);
      }
    }

    expect(path.length).toBeGreaterThan(500);
    expect(pairs).toBeGreaterThan(100);
    expect(missed).toEqual([]);
  });
});
