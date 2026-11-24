/**
 * Spring mushrooms (bounce cells) in run's nav and pilot, on small inline levels: a rival takes a
 * mushroom's launch onto a plateau no jump reaches, holding Up for the higher launch, however its
 * feet first meet the mushroom; the nav routes through a mushroom only when that is the quicker way;
 * and a mushroom in the floor is a place a runner may jump over rather than a stretch of floor to walk.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { parseLevel } from '../../level/parse.ts';
import { courseFromLevel, IDLE, placeOnTile, racerOf, step } from '../../test-world.ts';
import { RACER_IDS, type RacerId, TILE, type World } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { MEDIA } from '../index.ts';
import { runMotion } from './data.ts';
import { BOUNCE_HOLD_TICKS, buildLinks } from './links.ts';
import { type LinkKind, runNav } from './way-data.ts';

const NOTHING_BROKEN: ReadonlySet<number> = new Set();

/**
 * A plateau five tiles high (cols 11-18, rows 4-8) with the finish on top of it, a wall no jump
 * clears, and a mushroom in the floor at col 9 in front of it. Runners start on row 8.
 */
const PLATEAU = `
  ####################
  #.................F#
  #.................F#
  #.................F#
  #..........#########
  #..........#########
  #..........#########
  #..........#########
  #1.2.3.4...#########
  #########B##########
`;

/**
 * Two ways up to a shelf (rows 4-8 from col 12) with the finish on top: a mushroom in the floor at
 * col 10 just ahead of the starts, whose launch rises through a branch (`=`, row 5) onto the shelf,
 * or back left up two steps at cols 1-2 and along the branch. The mushroom is the quicker.
 */
const MUSHROOM_AHEAD = `
  ########################
  #....................F.#
  #....................F.#
  #....................F.#
  #...........############
  ##==========############
  ##..........############
  ###.........############
  ###.1234....############
  ##########B#############
`;

/**
 * Two ways up to a shelf (rows 4-8 from col 16) with the finish on top: two steps at cols 12-15 in
 * front of it, or a mushroom in the floor at col 2, behind the starts, whose launch rises through a
 * branch (`=`, row 5) to walk along. From col 3, beside the mushroom, the steps are the quicker by
 * about 20 ticks, a margin a bounce that cost no time would overturn.
 */
const MUSHROOM_BEHIND = `
  ########################
  #....................F.#
  #....................F.#
  #....................F.#
  #...............########
  #.==============########
  #...............########
  #.............##########
  #..1234.....############
  ##B#####################
`;

/** A flat floor at row 5 with a mushroom in it at col 8; runners stand on row 4. */
const FLAT = `
  ##############
  #............#
  #............#
  #............#
  #1234.......F#
  ########B#####
`;

describe('a spring mushroom in run nav', () => {
  it('links its tile only to where its launches land, the plateau among them, Up held to reach it', () => {
    const level = parseLevel({ name: 'plateau', ascii: PLATEAU });
    const links = buildLinks(level, NOTHING_BROKEN, MEDIA.run.tuning).get(8 * level.width + 9) ?? [];
    const onPlateau = links.filter((link) => Math.floor(link.to / level.width) === 3);

    expect(links.length).toBeGreaterThan(0);
    expect(links.every((link) => link.kind === 'bounce')).toBe(true);
    expect(onPlateau.map((link) => ({ dir: link.dir, holdTicks: link.holdTicks }))).toContainEqual({
      dir: 1,
      holdTicks: BOUNCE_HOLD_TICKS,
    });
  });

  it('lets a runner jump over it from the tile before to the tile after', () => {
    const level = parseLevel({ name: 'flat', ascii: FLAT });
    const before = 4 * level.width + 7;
    const after = 4 * level.width + 9;
    const links = buildLinks(level, NOTHING_BROKEN, MEDIA.run.tuning).get(before) ?? [];

    expect(links.filter((link) => link.to === after).map((link) => link.kind)).toEqual(['jump']);
  });
});

/** A racing world on `ascii` in run, with every rival but `free` stunned for the whole test. */
function raceWith(ascii: string, free: RacerId) {
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(courseFromLevel(ascii, 'run'), log, { seed: 1 });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  for (const racer of world.racers) if (racer.id !== free && racer.id !== 'player') racer.status.stunned = 10_000;
  return { world, log };
}

/** The kinds of the best links followed from tile (`col`, `row`) to the finish, in order. */
function routeKinds(world: World, col: number, row: number): LinkKind[] {
  const nav = runNav(world.nav);
  const kinds: LinkKind[] = [];
  let tile = row * nav.width + col;
  for (let link = nav.best[tile]; link && kinds.length < 60; link = nav.best[tile]) {
    kinds.push(link.kind);
    tile = link.to;
  }
  return kinds;
}

/** How many times `id` bounced. */
function bouncesOf(log: EventLog<GameEvent>, id: RacerId): number {
  return log.all().filter((event) => event.type === 'racer.bounced' && event.id === id).length;
}

describe('choosing a mushroom', () => {
  it('routes through the bounce when the mushroom is the quicker way up, and the rival takes it', () => {
    const { world, log } = raceWith(MUSHROOM_AHEAD, 'tess');
    const route = routeKinds(world, 7, 8);
    for (let tick = 0; tick < 900 && !racerOf(world, 'tess').finished; tick++) step(world, log, 1, IDLE);

    expect(route).toContain('bounce');
    expect(bouncesOf(log, 'tess')).toBe(1);
    expect(racerOf(world, 'tess').finished).not.toBeNull();
  });

  it('climbs the steps instead when they are quicker, though the mushroom is right behind it', () => {
    const { world, log } = raceWith(MUSHROOM_BEHIND, 'tess');
    const tess = racerOf(world, 'tess');
    placeOnTile(tess, 3, 8);
    const route = routeKinds(world, 3, 8);
    for (let tick = 0; tick < 900 && !tess.finished; tick++) step(world, log, 1, IDLE);

    expect(route).not.toContain('bounce');
    expect(route).toContain('jump');
    expect(bouncesOf(log, 'tess')).toBe(0);
    expect(tess.finished).not.toBeNull();
  });
});

describe('a rival walking onto a mushroom whose held launch is the only way up', () => {
  // The step a rival takes each tick is about 1.5 px, so these starts put its leading foot on the
  // mushroom at every part of a pixel, the first touch under 1 px in among them.
  it.each([0, 0.25, 0.5, 0.75, 1, 1.25])('bounces once onto the plateau, starting %s px right of col 6', (offset) => {
    const { world, log } = raceWith(PLATEAU, 'tess');
    const tess = racerOf(world, 'tess');
    placeOnTile(tess, 6, 8);
    tess.body.x += offset;
    tess.body.y = 9 * TILE - tess.body.h;
    runMotion(tess.motion).grounded = true;
    for (let tick = 0; tick < 600 && !tess.finished; tick++) step(world, log, 1, IDLE);

    expect(bouncesOf(log, 'tess')).toBe(1);
    expect(tess.finished).not.toBeNull();
  });
});

describe('rivals on a course whose only way on is a mushroom', () => {
  it('each bounce off it onto the plateau and finish', () => {
    const log = new EventLog<GameEvent>(100_000);
    const world = createWorld(courseFromLevel(PLATEAU, 'run'), log, { seed: 1 });
    world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
    for (let tick = 0; tick < 1200 && world.racers.some((racer) => racer.id !== 'player' && !racer.finished); tick++)
      step(world, log, 1, IDLE);
    const rivals = RACER_IDS.filter((id) => id !== 'player');
    const bounced = new Set(log.all().flatMap((event) => (event.type === 'racer.bounced' ? [event.id] : [])));

    expect(rivals.filter((id) => !bounced.has(id))).toEqual([]);
    expect(world.racers.filter((racer) => racer.id !== 'player' && !racer.finished).map((racer) => racer.id)).toEqual(
      [],
    );
  });
});
