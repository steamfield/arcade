import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { courseFromLevel, eventsIn, giveItems, hold, placeAt, racerOf, step, tileCentre } from '../../test-world.ts';
import { type Difficulty, type Shot, TILE, type Vec, type WellDef, type World } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { COMET, COMET_TUNING } from './comet.ts';

const WIDTH = 50;
const WALL = '#'.repeat(WIDTH);
/** The row the rivals start on, sealed off above the open room by a wall on row 2. */
const RIVAL_LANE = `#234${'.'.repeat(WIDTH - 5)}F`;
/** Open space with the finish on its right. */
const OPEN_ROW = `#${'.'.repeat(WIDTH - 2)}F`;
/** Where the player's comets fly from in most tests: the centre of tile (3, 7). */
const LAUNCH = tileCentre(3, 7);

/**
 * A Farside room 50 tiles wide: the rivals' lane on row 1, open space on rows 3-13 with the player
 * starting at (2, 8), and `extra` cells written over it as [col, row, glyph].
 */
function room(extra: readonly [number, number, string][] = []): string {
  const rows = [WALL, RIVAL_LANE, WALL, ...Array.from({ length: 11 }, () => OPEN_ROW), WALL];
  rows[8] = `#.1${'.'.repeat(WIDTH - 4)}F`;
  for (const [col, row, glyph] of extra) {
    const line = rows[row] ?? '';
    rows[row] = line.slice(0, col) + glyph + line.slice(col + 1);
  }
  return rows.join('\n');
}

/** A racing world in Farside (so the Cannonball fires a comet) on `ascii`, the player at LAUNCH. */
function farside(ascii: string, options: { wells?: readonly WellDef[]; difficulty?: Difficulty } = {}) {
  const course = courseFromLevel({ name: 'comet', ascii, wells: options.wells ?? [] }, 'drift', { world: 'farside' });
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(course, log, { seed: 1, endsWhen: 'everyone', difficulty: options.difficulty ?? 'hard' });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  const player = racerOf(world, 'player');
  placeAt(player, LAUNCH);
  return { world, log, player };
}

/** The player fires the Cannonball it is given along `aim` on the next tick. */
function fireComet(setup: ReturnType<typeof farside>, aim: Vec = { x: 1, y: 0 }): void {
  giveItems(setup.player, ['cannonball']);
  step(setup.world, setup.log, 1, hold(aim, { use: true }));
}

/** The only shot in flight. */
function onlyShot(world: World): Shot {
  const [shot, ...more] = world.shots;
  if (!shot || more.length > 0) throw new Error(`expected one shot in flight, found ${world.shots.length}`);
  return shot;
}

/** Steps until no shot is in flight, at most `limit` ticks; returns the ticks it took. */
function stepUntilEnded(setup: ReturnType<typeof farside>, limit = COMET_TUNING.ttlTicks + 5): number {
  for (let ticks = 1; ticks <= limit; ticks++) {
    step(setup.world, setup.log);
    if (setup.world.shots.length === 0) return ticks;
  }
  throw new Error(`the comet was still flying after ${limit} ticks`);
}

function endOf(log: EventLog<GameEvent>): { x: number; y: number } {
  const ends = eventsIn(log, 'shot.ended');
  const [end] = ends;
  if (end?.type !== 'shot.ended' || ends.length > 1) throw new Error(`expected one shot.ended, got ${ends.length}`);
  return { x: end.x, y: end.y };
}

const hitsOn = (log: EventLog<GameEvent>, id: string) =>
  eventsIn(log, 'racer.hit').filter((event) => event.type === 'racer.hit' && event.id === id);

describe('firing the Comet in Farside', () => {
  it('launches a comet from the racer along its aim instead of dashing, and its owner flies on unhurt', () => {
    const setup = farside(room());
    fireComet(setup);
    const shot = onlyShot(setup.world);

    expect(eventsIn(setup.log, 'shot.launched')).toEqual([
      { type: 'shot.launched', owner: 'player', style: 'comet', target: null },
    ]);
    expect(setup.player.status.dashing).toBe(0);
    expect({ vx: shot.vx, vy: shot.vy }).toEqual({ vx: COMET_TUNING.speed, vy: 0 });

    step(setup.world, setup.log, 10);
    expect(onlyShot(setup.world).y).toBe(shot.y);
    expect(hitsOn(setup.log, 'player')).toEqual([]);
  });

  it('burns out after 3 s in open space, where it stopped', () => {
    const setup = farside(room());
    fireComet(setup);
    const ticks = stepUntilEnded(setup);

    // Fired on the first tick, it has spent one tick of its time already.
    expect(ticks).toBe(COMET_TUNING.ttlTicks - 1);
    expect(Math.round(endOf(setup.log).x - LAUNCH.x)).toBe(Math.round(COMET_TUNING.speed * 3));
  });
});

describe('a comet and the gravity wells', () => {
  /** A planet four tiles below the comet's line at col 20, reaching six tiles. */
  const PLANET: WellDef = { col: 20, row: 11, reach: 6, pull: 160 };

  it('is bent toward a planet it passes, where with no planet it flies straight', () => {
    const yAfter = (wells: WellDef[]) => {
      const setup = farside(room(), { wells });
      fireComet(setup);
      step(setup.world, setup.log, 90);
      return onlyShot(setup.world).y;
    };

    expect(yAfter([])).toBe(LAUNCH.y);
    expect(yAfter([PLANET]) - LAUNCH.y).toBeGreaterThan(TILE / 2);
  });

  it('is swallowed by a black hole on its line and ends inside the horizon', () => {
    const hole: WellDef = { col: 12, row: 7, reach: 3, pull: 300, horizon: 1.5 };
    const setup = farside(room(), { wells: [hole] });
    fireComet(setup);
    stepUntilEnded(setup);
    const end = endOf(setup.log);
    const centre = tileCentre(hole.col, hole.row);

    expect(Math.sqrt((end.x - centre.x) ** 2 + (end.y - centre.y) ** 2)).toBeLessThan(1.5 * TILE);
  });
});

describe('a comet meeting the course', () => {
  it('breaks the ice it touches and ends there, opening both tiles of a gate it meets on their seam', () => {
    const setup = farside(
      room([
        [10, 6, 'C'],
        [10, 7, 'C'],
      ]),
    );
    placeAt(setup.player, { x: LAUNCH.x, y: 7 * TILE });
    fireComet(setup);
    stepUntilEnded(setup);

    expect(eventsIn(setup.log, 'coral.broken')).toEqual([
      { type: 'coral.broken', tx: 10, ty: 6, by: 'player' },
      { type: 'coral.broken', tx: 10, ty: 7, by: 'player' },
    ]);
    expect(endOf(setup.log).x).toBeLessThan(10 * TILE + COMET_TUNING.radius);
  });

  it('ends against rock, leaving it whole', () => {
    const setup = farside(room([[10, 7, '#']]));
    fireComet(setup);
    stepUntilEnded(setup);

    expect(eventsIn(setup.log, 'coral.broken')).toEqual([]);
    expect(Math.round(endOf(setup.log).x)).toBeLessThanOrEqual(10 * TILE + COMET_TUNING.radius);
    expect(Math.round(endOf(setup.log).x)).toBeGreaterThanOrEqual(10 * TILE - COMET_TUNING.radius - 4);
  });
});

describe('a comet meeting racers', () => {
  it('hits the first racer other than its owner that it touches, for its owner, and ends', () => {
    const setup = farside(room());
    placeAt(racerOf(setup.world, 'tess'), tileCentre(8, 7));
    placeAt(racerOf(setup.world, 'squib'), tileCentre(12, 7));
    fireComet(setup);
    stepUntilEnded(setup);

    expect(eventsIn(setup.log, 'racer.hit')).toEqual([{ type: 'racer.hit', id: 'tess', cause: 'comet', by: 'player' }]);
    expect(endOf(setup.log).x).toBeLessThan(9 * TILE);
  });

  it('flies through an invulnerable racer and hits the next one, instead of ending on a hit that does nothing', () => {
    const setup = farside(room());
    const shielded = racerOf(setup.world, 'tess');
    placeAt(shielded, tileCentre(8, 7));
    shielded.status.invulnerable = 120;
    placeAt(racerOf(setup.world, 'squib'), tileCentre(12, 7));
    fireComet(setup);
    stepUntilEnded(setup);

    expect(eventsIn(setup.log, 'racer.hit')).toEqual([
      { type: 'racer.hit', id: 'squib', cause: 'comet', by: 'player' },
    ]);
    expect(endOf(setup.log).x).toBeGreaterThan(8 * TILE + TILE);
  });

  it('from a rival on Easy passes through the human it may not attack, where on Hard it hits', () => {
    const rivalFiresAtPlayer = (difficulty: Difficulty) => {
      const setup = farside(room(), { difficulty });
      const rival = racerOf(setup.world, 'tess');
      placeAt(rival, tileCentre(3, 11));
      placeAt(setup.player, tileCentre(3, 7));
      COMET.fire(setup.world, rival, { x: 0, y: -1 });
      step(setup.world, setup.log, 25);
      return { hits: hitsOn(setup.log, 'player'), flying: setup.world.shots.length };
    };

    expect(rivalFiresAtPlayer('easy')).toEqual({ hits: [], flying: 1 });
    expect(rivalFiresAtPlayer('hard')).toEqual({
      hits: [{ type: 'racer.hit', id: 'player', cause: 'comet', by: 'tess' }],
      flying: 0,
    });
  });
});

describe('a rival choosing to fire the Comet', () => {
  const aimRight = { x: 1, y: 0 };

  it('wants it for a racer ahead inside its aim within 10 tiles, and not for one behind or out of range', () => {
    const wantsWith = (target: Vec) => {
      const { world } = farside(room());
      const rival = racerOf(world, 'tess');
      placeAt(rival, tileCentre(3, 7));
      placeAt(racerOf(world, 'squib'), target);
      placeAt(racerOf(world, 'player'), tileCentre(3, 12));
      placeAt(racerOf(world, 'bo'), tileCentre(3, 3));
      return COMET.rivalWants(world, rival, aimRight);
    };

    expect(wantsWith(tileCentre(10, 7))).toBe(true);
    expect(wantsWith(tileCentre(10, 9))).toBe(true);
    expect(wantsWith(tileCentre(10, 12))).toBe(false);
    expect(wantsWith(tileCentre(15, 7))).toBe(false);
    expect(wantsWith(tileCentre(1, 7))).toBe(false);
  });

  it('on Easy does not want it for a human ahead, whom its comet would pass through', () => {
    const wantsOn = (difficulty: Difficulty) => {
      const { world, player } = farside(room(), { difficulty });
      const rival = racerOf(world, 'tess');
      placeAt(rival, tileCentre(3, 7));
      placeAt(player, tileCentre(8, 7));
      return COMET.rivalWants(world, rival, aimRight);
    };

    expect(wantsOn('easy')).toBe(false);
    expect(wantsOn('hard')).toBe(true);
  });

  it('wants it for an ice wall just ahead whose way round is long', () => {
    // Ice down col 6 from row 3 to row 12; the only way round is the gap on row 13.
    const wall = Array.from({ length: 10 }, (_, i): [number, number, string] => [6, 3 + i, 'C']);
    const { world, player } = farside(room(wall));
    const rival = racerOf(world, 'tess');
    placeAt(player, tileCentre(3, 3));
    placeAt(rival, tileCentre(4, 7));

    expect(COMET.rivalWants(world, rival, aimRight)).toBe(true);
  });
});
