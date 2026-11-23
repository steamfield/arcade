/**
 * Run's rival pilot, driven through the medium's own `steer` on small inline levels (what it presses
 * on a given tile), through whole worlds (a rival crosses a pit without falling), and through whole
 * races on the `run-test` course.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../../ai/profiles.ts';
import { courseById } from '../../courses/index.ts';
import { race } from '../../difficulty/race-bots.ts';
import type { GameEvent } from '../../events.ts';
import { courseFromLevel, hold, placeOnTile, racerOf } from '../../test-world.ts';
import { CHARACTER_IDS, type Racer, TILE, type World } from '../../types.ts';
import { createWorld, stepWorld } from '../../world.ts';
import { MEDIA } from '../index.ts';
import type { AiDraws, Steering } from '../types.ts';
import { runMotion } from './data.ts';
import { runPilot } from './way-data.ts';

const run = MEDIA.run;

/** A draw that passes no skill roll, so a rival never dashes on it nor lets go of the stick. */
const NO_DASH: AiDraws = { wobble: 0.999, kick: 0.999, side: 0, item: 0 };
/** A draw that a loose profile's wobble lets go of the stick on. */
const SHAKY: AiDraws = { ...NO_DASH, wobble: 0 };
/** A draw that passes every skill roll the expert profile allows. */
const DASH_ROLL: AiDraws = { ...NO_DASH, kick: 0 };

/** A world in run on `ascii`, before the countdown has moved anyone. */
function runWorld(ascii: string): World {
  return createWorld(courseFromLevel(ascii, 'run'), new EventLog<GameEvent>(100_000), { seed: 1 });
}

/** Tess standing on tile (tx, ty) with fresh pilot memory, as `afterMove` leaves a runner on the ground. */
function standingRival(world: World, tx: number, ty: number): Racer {
  const tess = racerOf(world, 'tess');
  placeOnTile(tess, tx, ty);
  tess.body.y = (ty + 1) * TILE - tess.body.h;
  runMotion(tess.motion).grounded = true;
  if (tess.ai) tess.ai.pilot = run.createPilot();
  return tess;
}

/** Tess's steering this tick. */
function steer(world: World, racer: Racer, draws = NO_DASH, forceRecover = false): Steering {
  return run.steer(world, racer, run.tuning.base, draws, forceRecover);
}

/** How many ticks in a row, from now, the rival holds Up (0 when it doesn't jump). */
function upTicks(world: World, racer: Racer): number {
  let ticks = 0;
  while (ticks < 120 && steer(world, racer).move.y < 0) ticks++;
  return ticks;
}

/** A level with a wall `height` tiles high at col 5, right of the starts, and the finish at col 10. Runners stand on row 6. */
function wallLevel(height: number): string {
  const air = [1, 2, 3, 4, 5].map((row) => `#....${row > 6 - height ? '#' : '.'}....F#`);
  return ['############', ...air, '#1234#....F#', '############'].join('\n');
}

/** Six rows of air over a floor with the starts on it and a pit at cols 8-10, open out of the bottom. */
const PIT_LEVEL = `
  ####################
  #..................#
  #..................#
  #..................#
  #..................#
  #..................#
  #1.2.3.4..........F#
  ########...#########
`;

/** A wall four tiles high, too high to jump, with a ledge two tiles up in front of it. */
const LEDGE_LEVEL = `
  ##################
  #...............F#
  #...............F#
  #...............F#
  #...........######
  #...........######
  #.......====######
  #1.2.3.4....######
  ##################
`;

describe('the run rival pilot on the ground', () => {
  it('jumps a wall ahead, holding Up for the jump', () => {
    const holds = [1, 2].map((height) => {
      const world = runWorld(wallLevel(height));
      return upTicks(world, standingRival(world, 4, 6));
    });

    expect(holds.every((ticks) => ticks > 0)).toBe(true);
  });

  it('runs up to a pit before it jumps, and jumps with a long hold at its edge', () => {
    const world = runWorld(PIT_LEVEL);
    const twoTileWall = runWorld(wallLevel(2));
    const wallHold = upTicks(twoTileWall, standingRival(twoTileWall, 4, 6));

    expect(steer(world, standingRival(world, 5, 6))).toMatchObject({ move: { x: 1, y: 0 } });
    expect(steer(world, standingRival(world, 7, 6))).toMatchObject({ move: { x: 1, y: 0 } });
    const atTheLip = standingRival(world, 7, 6);
    atTheLip.body.x += TILE / 2;
    expect(upTicks(world, atTheLip)).toBeGreaterThan(wallHold);
  });

  it('hops onto a ledge when the wall ahead is too high to jump', () => {
    const world = runWorld(LEDGE_LEVEL);

    expect(upTicks(world, standingRival(world, 11, 7))).toBeGreaterThan(0);
  });

  it('lets go of Up for a tick before it jumps again', () => {
    const world = runWorld(wallLevel(2));
    const tess = standingRival(world, 4, 6);
    const ups = Array.from({ length: 60 }, () => steer(world, tess).move.y < 0);
    const release = ups.indexOf(false);

    expect(release).toBeGreaterThan(0);
    expect(ups.slice(release, release + 2)).toEqual([false, true]);
  });

  it('dashes when running on flat ground with the dash ready and the skill roll passed, and not otherwise', () => {
    const world = runWorld(PIT_LEVEL);
    const running = (tx: number) => {
      const tess = standingRival(world, tx, 6);
      tess.body.vx = 100;
      return tess;
    };

    expect(steer(world, running(2), DASH_ROLL).kick).toBe(true);
    expect(steer(world, running(2), NO_DASH).kick).toBe(false);
    expect(steer(world, running(6), DASH_ROLL).kick).toBe(false);
    const cooling = running(2);
    cooling.kickCooldown = 1;
    expect(steer(world, cooling, DASH_ROLL).kick).toBe(false);
    const standingStill = standingRival(world, 2, 6);
    standingStill.kickCooldown = 0;
    expect(steer(world, standingStill, DASH_ROLL).kick).toBe(false);
  });
});

/** PIT_LEVEL with the pit moved one tile nearer: cols 7-9, five tiles past tile 2. */
const NEAR_PIT_LEVEL = `
  ####################
  #..................#
  #..................#
  #..................#
  #..................#
  #..................#
  #1.2.3.4..........F#
  #######...##########
`;

describe('the run rival pilot among other racers', () => {
  /** Tess running right at `speed` on tile (2, 6) of `level`, with Squib on the next tile at `aheadSpeed`. */
  function closingOn(speed: number, aheadSpeed: number, level = PIT_LEVEL): { world: World; tess: Racer } {
    const world = runWorld(level);
    const tess = standingRival(world, 2, 6);
    tess.body.vx = speed;
    const squib = racerOf(world, 'squib');
    placeOnTile(squib, 3, 6);
    squib.body.y = tess.body.y;
    squib.body.vx = aheadSpeed;
    return { world, tess };
  }

  it('hops over a slower racer just ahead on flat ground', () => {
    const { world, tess } = closingOn(160, 100);

    expect(upTicks(world, tess)).toBeGreaterThan(0);
  });

  it('does not hop out of its own dash when the hop would land past the ground ahead', () => {
    const atRunPace = closingOn(100, 60, NEAR_PIT_LEVEL);
    const dashing = closingOn(200, 60, NEAR_PIT_LEVEL);

    expect(upTicks(atRunPace.world, atRunPace.tess)).toBeGreaterThan(0);
    expect(upTicks(dashing.world, dashing.tess)).toBe(0);
  });

  it('follows a racer ahead running as fast as it is', () => {
    const { world, tess } = closingOn(100, 100);

    expect(steer(world, tess).move).toEqual({ x: 1, y: 0 });
  });
});

describe('the run rival pilot with loose steering', () => {
  it('now and then lets go of the stick on flat ground when its profile is loose, and never when steady', () => {
    const world = runWorld(PIT_LEVEL);
    const loose = standingRival(world, 2, 6);
    loose.profile = BOT_PROFILES.novice;
    const steadyWorld = runWorld(PIT_LEVEL);
    const steady = standingRival(steadyWorld, 2, 6);
    steady.profile = { ...BOT_PROFILES.novice, wobble: 0 };

    expect([steer(world, loose, SHAKY).move.x, steer(world, loose, NO_DASH).move.x]).toEqual([0, 1]);
    expect(steer(steadyWorld, steady, SHAKY).move.x).toBe(1);
  });
});

describe('the run rival pilot in the air', () => {
  /** Tess in the air over the pit, mid-jump from the left edge toward the far side, with `landing` the tile she means to reach. */
  function flyingRival(world: World, centreTile: number): Racer {
    const tess = standingRival(world, centreTile, 5);
    runMotion(tess.motion).grounded = false;
    const memory = runPilot(tess.ai?.pilot ?? run.createPilot());
    memory.landingTile = 6 * world.level.width + 11;
    memory.inFlight = true;
    return tess;
  }

  it('steers toward the middle of the tile it means to land on, and stops steering over it', () => {
    const world = runWorld(PIT_LEVEL);
    const sideways = (tile: number) => steer(world, flyingRival(world, tile)).move.x;

    expect([sideways(9), sideways(11), sideways(13)]).toEqual([1, 0, -1]);
  });

  it('lets go of Up the tick it lands, even with hold ticks left', () => {
    const world = runWorld(PIT_LEVEL);
    const tess = flyingRival(world, 10);
    runPilot(tess.ai?.pilot ?? run.createPilot()).holdUpTicks = 9;
    runMotion(tess.motion).grounded = true;

    expect(steer(world, tess).move.y).toBe(0);
  });
});

describe('the run rival pilot when stuck', () => {
  it('starts a recovery jump only once a runner caught in the air stands again', () => {
    const world = runWorld(PIT_LEVEL);
    const tess = standingRival(world, 4, 6);
    runMotion(tess.motion).grounded = false;
    const inTheAir = Array.from({ length: 20 }, (_, tick) => steer(world, tess, NO_DASH, tick === 0));
    runMotion(tess.motion).grounded = true;

    expect(inTheAir.filter((steering) => steering.move.y !== 0 || !steering.recovering)).toEqual([]);
    expect(steer(world, tess)).toMatchObject({ move: { x: 1, y: -1 }, recovering: true });
  });

  it('on a forced recovery backs off from the finish, then jumps toward it', () => {
    const world = runWorld(PIT_LEVEL);
    const tess = standingRival(world, 4, 6);
    const moves = Array.from({ length: 31 }, (_, tick) => steer(world, tess, NO_DASH, tick === 0));

    expect(moves[0]).toMatchObject({ move: { x: -1, y: 0 }, kick: false, recovering: true });
    expect(moves[29]).toMatchObject({ move: { x: 1, y: -1 }, recovering: true });
    expect(moves[30]?.recovering).toBe(false);
  });
});

/**
 * A block at col 13 with a crate on top of the air above it, then a pit at cols 18-20. The plan from
 * the crate's top (13, 4) is a short hop down to col 17, the pit's lip: planned at running pace, it
 * lands a tile past the lip at a dash's speed.
 */
const CRATE_HOP_LEVEL = `
  ##############################
  #............................#
  #............................#
  #............................#
  #............................#
  #............?...............#
  #............................#
  #1.2.3.4.....#..............F#
  ##################...#########
  ##################...#########
`;

/** A Tailwind lane blowing right over cols `fromCol` up to `toCol` (exclusive), from row 1 to the floor, lasting the whole test. */
function layTailwind(world: World, fromCol: number, toCol: number): void {
  const lane = { x: fromCol * TILE, y: TILE, w: (toCol - fromCol) * TILE, h: 7 * TILE, dir: { x: 1, y: 0 } };
  world.riptides.push({ ...lane, ttl: 100_000, owner: 'player' });
}

/** Each tick's facing while `racer` is in the air, over `ticks` steps of `world` with the player idle. */
function airFacings(world: World, racer: Racer, ticks: number): number[] {
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  const facings: number[] = [];
  for (let tick = 0; tick < ticks; tick++) {
    stepWorld(world, hold({ x: 0, y: 0 }), TICK_DT);
    if (!runMotion(racer.motion).grounded && racer.status.fallen === 0) facings.push(racer.facing);
  }
  return facings;
}

/** Steps `world` with the player idle until Tess finishes or `limit` ticks pass; returns the events about her. */
function raceTess(world: World, log: EventLog<GameEvent>, limit: number) {
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  const tess = racerOf(world, 'tess');
  for (let tick = 0; tick < limit && !tess.finished; tick++) stepWorld(world, hold({ x: 0, y: 0 }), TICK_DT);
  const events = log.all().filter((event) => 'id' in event && event.id === 'tess');
  return { finished: tess.finished !== null, falls: events.filter((event) => event.type === 'racer.fell').length };
}

describe('a rival on a course', () => {
  it('crosses a pit without falling into it', () => {
    const log = new EventLog<GameEvent>(100_000);
    const world = createWorld(courseFromLevel(PIT_LEVEL, 'run'), log, { seed: 1 });

    expect(raceTess(world, log, 1200)).toEqual({ finished: true, falls: 0 });
  });

  it.each([1, 2])('clears a wall %i tiles high', (height) => {
    const log = new EventLog<GameEvent>(100_000);
    const world = createWorld(courseFromLevel(wallLevel(height), 'run'), log, { seed: 1 });

    expect(raceTess(world, log, 1200)).toEqual({ finished: true, falls: 0 });
  });

  it('takes a jump at a speed it can land: a short hop off a crate to the lip of a pit, at dash speed', () => {
    const falls = [100, 200].map((speed) => {
      const log = new EventLog<GameEvent>(100_000);
      const world = createWorld(courseFromLevel(CRATE_HOP_LEVEL, 'run'), log, { seed: 1 });
      const tess = standingRival(world, 13, 4);
      tess.body.vx = speed;
      runMotion(tess.motion).dashGlide = speed;
      tess.kickCooldown = 1200;
      return raceTess(world, log, 1200);
    });

    expect(falls).toEqual([
      { finished: true, falls: 0 },
      { finished: true, falls: 0 },
    ]);
  });

  it('comes down on the lip of a pit after a tailwind lane over the run-up carries it faster than planned', () => {
    const log = new EventLog<GameEvent>(100_000);
    const world = createWorld(courseFromLevel(CRATE_HOP_LEVEL, 'run'), log, { seed: 1 });
    standingRival(world, 11, 7);
    layTailwind(world, 13, 18);

    expect(raceTess(world, log, 1200)).toEqual({ finished: true, falls: 0 });
  });

  it('keeps its stick one way from one tick to the next in the air above a pit, in a tailwind', () => {
    const world = createWorld(courseFromLevel(CRATE_HOP_LEVEL, 'run'), new EventLog<GameEvent>(100_000), { seed: 1 });
    const tess = standingRival(world, 13, 4);
    layTailwind(world, 8, 16);
    const facings = airFacings(world, tess, 120);
    const blips = facings.filter(
      (facing, tick) => tick > 0 && facing !== facings[tick - 1] && facings[tick + 1] === facings[tick - 1],
    );

    expect(facings.length).toBeGreaterThan(0);
    expect(blips).toEqual([]);
  });

  it('climbs a ledge to get past a wall too high to jump', () => {
    const log = new EventLog<GameEvent>(100_000);
    const world = createWorld(courseFromLevel(LEDGE_LEVEL, 'run'), log, { seed: 1 });

    expect(raceTess(world, log, 1200)).toEqual({ finished: true, falls: 0 });
  });
});

describe('the run-test course', () => {
  const course = courseById('run-test');

  it('has every rival finish under par from every start, across seeds 1-5 and all characters', () => {
    if (!course) throw new Error("Course 'run-test' isn't registered");
    const late = CHARACTER_IDS.flatMap((character) =>
      [1, 2, 3, 4, 5].flatMap((seed) => {
        const { finish } = race(BOT_PROFILES.expert, character, seed, 'hard', course.id);
        return Object.entries(finish)
          .filter(([id, tick]) => id !== 'player' && (tick === null || tick > course.parTicks))
          .map(([id, tick]) => `${character} seed ${seed} ${id} ${tick ?? 'DNF'}`);
      }),
    );

    expect(late).toEqual([]);
  });
});
