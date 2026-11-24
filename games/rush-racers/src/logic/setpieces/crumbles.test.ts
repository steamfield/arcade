import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { courseById } from '../courses/index.ts';
import type { GameEvent } from '../events.ts';
import { LevelError } from '../level/level-error.ts';
import { tileIndex } from '../level/query.ts';
import { FLYING, MUD_PIE } from '../powerups/twists/mud-pie.ts';
import { courseFromLevel, eventsIn, IDLE, placeOnTile, racerOf, ticksOf } from '../test-world.ts';
import { type CrumbleDef, RACER_IDS, TILE, type World } from '../types.ts';
import { createWorld, stepRace } from '../world.ts';

const BRANCH = { col: 5, row: 3, length: 3 };
const TOP = BRANCH.row * TILE;
const SHAKE_TICKS = 40;
const FALLEN_TICKS = 300;
const RUN_TEST = courseById('run-test');
if (!RUN_TEST) throw new Error('Run Test needs to be registered');

function branchCourse(crumbles: readonly CrumbleDef[] = [BRANCH]) {
  return courseFromLevel(
    {
      name: 'branch over a floor',
      crumbles,
      ascii: `
        ############
        #..........#
        #.........F#
        #....===..F#
        #.........F#
        #1234.....F#
        ############
      `,
    },
    'run',
  );
}

function branchRace() {
  const log = new EventLog<GameEvent>();
  const world = createWorld(branchCourse(), log, { seed: 1, humans: RACER_IDS });
  world.race.phase = 'racing';
  const player = racerOf(world, 'player');
  return { world, log, player };
}

function step(world: World, log: EventLog<GameEvent>, ticks = 1): void {
  for (let i = 0; i < ticks; i++) {
    log.tick = world.tick + 1;
    const inputs = world.humans.length === 1 ? { player: IDLE } : { player: IDLE, tess: IDLE, squib: IDLE, bo: IDLE };
    stepRace(world, inputs, TICK_DT);
  }
}

describe('crumble definitions', () => {
  it.each([
    { defs: [{ ...BRANCH, col: -1 }], reason: /off the map/, row: 3, col: -1 },
    { defs: [{ ...BRANCH, row: 7 }], reason: /off the map/, row: 7, col: 5 },
    { defs: [{ ...BRANCH, col: 11 }], reason: /off the map/, row: 3, col: 12 },
    { defs: [{ ...BRANCH, length: 4 }], reason: /ledge/, row: 3, col: 8 },
    { defs: [{ ...BRANCH, length: 0 }], reason: /length/, row: 3, col: 5 },
    { defs: [{ ...BRANCH, length: 13 }], reason: /length/, row: 3, col: 5 },
    { defs: [{ ...BRANCH, length: 1.5 }], reason: /length/, row: 3, col: 5 },
    { defs: [BRANCH, { col: 7, row: 3, length: 1 }], reason: /overlap/, row: 3, col: 7 },
  ])('reports $reason at row $row, col $col', ({ defs, reason, row, col }) => {
    expect(() => createWorld(branchCourse(defs), new EventLog<GameEvent>(), { seed: 1 })).toThrow(
      expect.objectContaining({ name: LevelError.name, message: expect.stringMatching(reason), row, col }),
    );
  });
});

describe('a crumbling branch', () => {
  it('shakes once when a racer lands on its far tile and keeps holding during the warning', () => {
    const { world, log, player } = branchRace();
    placeOnTile(player, BRANCH.col + BRANCH.length - 1, BRANCH.row - 1);
    step(world, log, 12);

    expect(eventsIn(log, 'crumble.shook')).toEqual([{ type: 'crumble.shook', crumble: 0 }]);
    const [shook = 0] = ticksOf(log, 'crumble.shook');
    step(world, log, shook + SHAKE_TICKS - 1 - world.tick);

    expect(world.crumbles[0]).toMatchObject({ phase: 'shaking', ticks: 1 });
    expect(world.fallen.size).toBe(0);
    expect(player.body.y + player.body.h).toBeCloseTo(TOP);
    expect(eventsIn(log, 'crumble.shook')).toHaveLength(1);
    expect(eventsIn(log, 'crumble.fell')).toHaveLength(0);
  });

  it('falls after the warning and lets the racer drop through without rebuilding nav', () => {
    const { world, log, player } = branchRace();
    const nav = world.nav;
    placeOnTile(player, BRANCH.col, BRANCH.row - 1);
    step(world, log, 12);
    const [shook = 0] = ticksOf(log, 'crumble.shook');
    step(world, log, shook + SHAKE_TICKS - world.tick);

    expect(ticksOf(log, 'crumble.fell')).toEqual([shook + SHAKE_TICKS]);
    expect(world.crumbles[0]).toMatchObject({ phase: 'fallen', ticks: FALLEN_TICKS });
    expect(world.fallen).toEqual(new Set([5, 6, 7].map((col) => tileIndex(world.level, col, BRANCH.row))));
    expect(world.nav).toBe(nav);
    step(world, log);
    expect(player.body.y + player.body.h).toBeGreaterThan(TOP);
  });

  it('regrows after its full fallen time when it is clear', () => {
    const { world, log, player } = branchRace();
    const nav = world.nav;
    placeOnTile(player, BRANCH.col, BRANCH.row - 1);
    step(world, log, 55);
    const [fell = 0] = ticksOf(log, 'crumble.fell');
    step(world, log, fell + FALLEN_TICKS - 1 - world.tick);

    expect(world.crumbles[0]?.phase).toBe('fallen');
    expect(eventsIn(log, 'crumble.regrew')).toHaveLength(0);
    step(world, log);

    expect(ticksOf(log, 'crumble.regrew')).toEqual([fell + FALLEN_TICKS]);
    expect(world.crumbles[0]?.phase).toBe('solid');
    expect(world.fallen.size).toBe(0);
    expect(world.nav).toBe(nav);
  });

  it('waits to regrow while part of a racer overlaps, then regrows as soon as it clears', () => {
    const { world, log, player } = branchRace();
    placeOnTile(player, BRANCH.col, BRANCH.row - 1);
    step(world, log, 55);
    const [fell = 0] = ticksOf(log, 'crumble.fell');
    step(world, log, fell + FALLEN_TICKS - 1 - world.tick);
    placeOnTile(player, BRANCH.col + BRANCH.length, BRANCH.row);
    player.body.x -= 3; // Only the trailing edge is inside the last branch tile.
    step(world, log);
    expect(eventsIn(log, 'crumble.regrew')).toHaveLength(0);
    expect(world.crumbles[0]).toMatchObject({ phase: 'fallen', ticks: 0 });
    expect(world.fallen.size).toBe(BRANCH.length);

    player.body.x += 3;
    step(world, log);
    expect(ticksOf(log, 'crumble.regrew')).toEqual([fell + FALLEN_TICKS + 1]);
    expect(world.fallen.size).toBe(0);
  });

  it('stays solid when nobody stands on it, even when a racer passes through its side', () => {
    const { world, log, player } = branchRace();
    placeOnTile(player, BRANCH.col - 1, BRANCH.row);
    player.body.vx = 100;
    step(world, log, 440);
    expect(eventsIn(log, 'crumble.shook', 'crumble.fell', 'crumble.regrew')).toEqual([]);
    expect(world.crumbles[0]?.phase).toBe('solid');
  });
});

it('a Run Test rival finishes by the low road after the branch falls ahead', () => {
  const log = new EventLog<GameEvent>();
  const world = createWorld(RUN_TEST, log, { seed: 1, endsWhen: 'everyone' });
  world.race.phase = 'racing';
  const player = racerOf(world, 'player');
  const rival = racerOf(world, 'tess');
  const [branch] = world.level.crumbles;
  if (!branch) throw new Error('Run Test needs a rotten branch');
  placeOnTile(player, branch.col, branch.row - 1);
  rival.status.stunned = 55;
  placeOnTile(rival, branch.col - 2, branch.row - 1);

  step(world, log, 55);
  expect(world.crumbles[0]?.phase).toBe('fallen');
  let wentUnder = false;
  for (let tick = 0; tick < 240 && !rival.finished; tick++) {
    step(world, log);
    const col = Math.floor((rival.body.x + rival.body.w / 2) / TILE);
    if (
      col >= branch.col &&
      col < branch.col + branch.length &&
      rival.body.y + rival.body.h > branch.row * TILE + TILE
    ) {
      wentUnder = true;
    }
  }
  expect(wentUnder, 'the rival went under the fallen span').toBe(true);
  expect(rival.finished).not.toBeNull();
});

it('a Run Test rival uses the lower mushroom bounce when its high landing is gone', () => {
  const minFeet = (fallFirst: boolean) => {
    const log = new EventLog<GameEvent>();
    const world = createWorld(RUN_TEST, log, { seed: 1 });
    const player = racerOf(world, 'player');
    const rival = racerOf(world, 'tess');
    world.race.phase = 'racing';
    rival.status.stunned = 56;
    if (fallFirst) placeOnTile(player, 59, 8);
    step(world, log, 55);
    expect(world.crumbles[0]?.phase).toBe(fallFirst ? 'fallen' : 'solid');
    placeOnTile(rival, 53, 8);
    rival.body.y = 9 * TILE - rival.body.h;
    let peak = Number.POSITIVE_INFINITY;
    for (let tick = 0; tick < 35; tick++) {
      step(world, log);
      peak = Math.min(peak, rival.body.y + rival.body.h);
    }
    return peak;
  };

  expect(minFeet(true) - minFeet(false)).toBeGreaterThan(TILE / 2);
});

it('a rival turns back for a lower tunnel when its jump onto a branch is gone', () => {
  const course = courseFromLevel(
    {
      name: 'tunnel below a shelf and wall',
      crumbles: [{ col: 8, row: 6, length: 3 }],
      ascii: `
        #####################
        #.................F.#
        #.................F.#
        #.................F.#
        #..........####...F.#
        #..........####...F.#
        #.......===####...F.#
        #......1234####...F.#
        #.....#########...F.#
        #.................F.#
        #####################
      `,
    },
    'run',
  );
  const log = new EventLog<GameEvent>();
  const world = createWorld(course, log, { seed: 1, humans: ['player', 'squib', 'bo'] });
  world.race.phase = 'racing';
  const rival = racerOf(world, 'tess');
  const player = racerOf(world, 'player');
  placeOnTile(player, 8, 5);
  placeOnTile(rival, 9, 7);
  placeOnTile(racerOf(world, 'squib'), 1, 9);
  placeOnTile(racerOf(world, 'bo'), 3, 9);
  rival.status.stunned = 55;
  step(world, log, 55);
  expect(world.crumbles[0]?.phase).toBe('fallen');
  placeOnTile(player, 1, 7);

  step(world, log, 240);
  expect(world.crumbles[0]?.phase).toBe('fallen');
  expect(rival.finished).not.toBeNull();
  expect(rival.body.y + rival.body.h).toBeCloseTo(10 * TILE);
});

it('respawns on firm ground when the last branch a racer stood on has since fallen', () => {
  const course = courseFromLevel(
    {
      name: 'branch before a pit',
      crumbles: [{ col: 6, row: 5, length: 3 }],
      ascii: `
        #################
        #..............F#
        #..............F#
        #..............F#
        #1234..........F#
        ######===..######
        ######.....######
        #########..######
        #########..######
      `,
    },
    'run',
  );
  const log = new EventLog<GameEvent>();
  const world = createWorld(course, log, { seed: 1, humans: RACER_IDS });
  world.race.phase = 'racing';
  const player = racerOf(world, 'player');
  placeOnTile(player, 5, 4);
  step(world, log, 10);
  placeOnTile(player, 7, 4);
  step(world, log, 10);
  expect(world.crumbles[0]?.phase).toBe('shaking');

  placeOnTile(player, 9, 4);
  step(world, log, 115);

  expect(world.crumbles[0]?.phase).toBe('fallen');
  const [respawned] = eventsIn(log, 'racer.respawned');
  expect(respawned).toMatchObject({ id: 'player' });
  expect(respawned?.type === 'racer.respawned' && respawned.x).toBeLessThan(6 * TILE);
  expect(player.body.y + player.body.h).toBeCloseTo(5 * TILE);
});

it('a Mud Pie in flight through the fallen span splats on the floor below', () => {
  const { world, log, player } = branchRace();
  placeOnTile(player, BRANCH.col, BRANCH.row - 1);
  step(world, log, 55);
  expect(world.crumbles[0]?.phase).toBe('fallen');
  world.twists.push({
    style: 'mudPie',
    owner: 'tess',
    x: (BRANCH.col + 1.5) * TILE,
    y: TOP - 8,
    vx: 0,
    vy: 100,
    ttl: 60,
    phase: FLYING,
  });

  step(world, log, 35);
  expect(eventsIn(log, 'twist.landed')).toMatchObject([{ style: 'mudPie', y: 6 * TILE }]);
});

it('treats the branch as ground for a Mud Pie target until it falls', () => {
  const { world, log, player } = branchRace();
  const tess = racerOf(world, 'tess');
  placeOnTile(player, BRANCH.col, BRANCH.row - 1);
  step(world, log, 12);
  expect(MUD_PIE.rivalWants(world, tess, { x: 1, y: 0 })).toBe(true);

  const [shook = 0] = ticksOf(log, 'crumble.shook');
  step(world, log, shook + SHAKE_TICKS - world.tick);
  expect(player.body.y + player.body.h).toBeCloseTo(TOP);
  expect(MUD_PIE.rivalWants(world, tess, { x: 1, y: 0 })).toBe(false);
});
