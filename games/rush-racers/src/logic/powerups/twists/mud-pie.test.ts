/**
 * Thornwood's Mud Pie, raced through `createWorld` on small inline Thornwood courses: the player
 * throws its Ink Sac with Use, a rival's throw goes through the style's own `fire`. The rivals start
 * behind the player, stunned for the whole test, so the only runner moving is the player.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import {
  courseFromLevel,
  eventsIn,
  giveItems,
  hold,
  IDLE,
  placeOnTile,
  racerOf,
  step,
  ticksOf,
} from '../../test-world.ts';
import { type Difficulty, type Racer, type RacerId, TILE, type World } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { twistRules, twistStyleOf } from './index.ts';
import { MUD_PIE_TUNING } from './mud-pie.ts';

/** A long floor at row 5 (runners on row 4) with the rivals' starts behind the player's. */
const FLOOR = `
  ########################################
  #......................................#
  #......................................#
  #......................................#
  #2.3.4.1.............................F.#
  ########################################
`;

/** `FLOOR` with a three-tile pit at cols 11-13, open out of the bottom of the level. */
const PIT = `
  ########################################
  #......................................#
  #......................................#
  #......................................#
  #2.3.4.1.............................F.#
  ###########...##########################
  ###########...##########################
`;

/** `FLOOR` with a shut crate standing on the floor at col 12. */
const CRATE = `
  ########################################
  #......................................#
  #......................................#
  #......................................#
  #2.3.4.1....?........................F.#
  ########################################
`;

const RIVALS: readonly RacerId[] = ['tess', 'squib', 'bo'];
/** Ticks the rivals stay stunned: longer than any test runs. */
const HELD_TICKS = 10_000;
const THROW_RIGHT = hold({ x: 1, y: 0 }, { use: true });
const RUN_RIGHT = hold({ x: 1, y: 0 });
/** Run's `mudSpeedMul`: a runner in mud tops out at this share of its pace. */
const MUD_SPEED_MUL = 0.6;
/** Where every pie in the speed tests is thrown from: far enough ahead that the player is at full pace when it reaches the patch. */
const THROW_COL = 14;
/** Where the player starts its run-up in the speed tests. */
const RUN_UP_COL = 4;
/** Where a pie thrown from `THROW_COL` splats, in px: 5.5 tiles on, as the arc test shows. */
const PATCH_X = (THROW_COL + 0.5 + 5.5) * TILE;

/** A racing Thornwood world on `ascii` with the player holding an Ink Sac and every rival stunned. */
function thornwoodRace(ascii: string, difficulty: Difficulty = 'hard') {
  const log = new EventLog<GameEvent>(100_000);
  const course = courseFromLevel(ascii, 'run', { world: 'thornwood' });
  const world = createWorld(course, log, { seed: 1, difficulty });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'player' };
  for (const id of RIVALS) racerOf(world, id).status.stunned = HELD_TICKS;
  const player = racerOf(world, 'player');
  giveItems(player, ['inkSac']);
  return { world, log, player };
}

/** Stands `racer` on tile (`col`, `row`) of the floor, facing right. */
function standOn(racer: Racer, col: number, row: number): void {
  placeOnTile(racer, col, row);
  racer.body.y = (row + 1) * TILE - racer.body.h;
  racer.facing = 1;
}

/** Steps idle until the pie in play has splatted or ended, at most `limit` ticks. */
function stepUntilSettled(world: World, log: EventLog<GameEvent>, limit = 200): void {
  for (let ticks = 0; ticks < limit && world.twists.some((twist) => twist.phase === 0); ticks++)
    step(world, log, 1, IDLE);
}

/** Where each pie splatted, in px. */
function landings(log: EventLog<GameEvent>) {
  return eventsIn(log, 'twist.landed').map((event) =>
    event.type === 'twist.landed' ? { x: event.x, y: event.y } : null,
  );
}

/**
 * Has `thrower` lob a pie from `THROW_COL` and lets it splat, then runs the player right from
 * `RUN_UP_COL` until its centre reaches the patch's centre; returns its speed there. With no
 * thrower nothing is thrown, and the player's speed is read at the same spot.
 */
function speedAtPatch(thrower: RacerId | null, difficulty: Difficulty = 'hard'): number {
  const { world, log, player } = thornwoodRace(FLOOR, difficulty);
  if (thrower) {
    const racer = racerOf(world, thrower);
    standOn(racer, THROW_COL, 4);
    twistRules('mudPie').fire(world, racer, { x: 1, y: 0 });
    stepUntilSettled(world, log);
  }
  standOn(player, RUN_UP_COL, 4);
  for (let ticks = 0; ticks < 300 && player.body.x + player.body.w / 2 < PATCH_X; ticks++)
    step(world, log, 1, RUN_RIGHT);
  return player.body.vx;
}

describe("Thornwood's Ink Sac", () => {
  it('is the Mud Pie; the reef keeps the shared ink', () => {
    const thornwood = thornwoodRace(FLOOR).world;
    const reef = createWorld(courseFromLevel('#1234F#'), new EventLog<GameEvent>(100), { seed: 1 });

    expect([twistStyleOf(thornwood, 'inkSac'), twistStyleOf(reef, 'inkSac')]).toEqual(['mudPie', null]);
  });
});

describe('a thrown mud pie', () => {
  it('arcs up and forward from the thrower and splats on the floor ahead', () => {
    const { world, log, player } = thornwoodRace(FLOOR);
    standOn(player, 7, 4);
    const from = { x: player.body.x + player.body.w / 2, y: player.body.y + player.body.h / 2 };
    step(world, log, 1, THROW_RIGHT);
    let highest = from.y;
    for (let ticks = 0; ticks < 200 && world.twists[0]?.phase === 0; ticks++) {
      highest = Math.min(highest, world.twists[0]?.y ?? highest);
      step(world, log, 1, IDLE);
    }
    const [landed] = landings(log);

    expect(eventsIn(log, 'twist.launched', 'twist.landed').map((event) => event.type)).toEqual([
      'twist.launched',
      'twist.landed',
    ]);
    expect(from.y - highest).toBeGreaterThan(TILE);
    // On the floor's top (row 5), about 5 tiles on: 160 px/s for the half second the arc takes.
    expect(landed?.y).toBe(5 * TILE);
    expect(((landed?.x ?? 0) - from.x) / TILE).toBeCloseTo(5.5, 0);
    expect(eventsIn(log, 'item.used')).toMatchObject([{ id: 'player', kind: 'inkSac' }]);
  });

  it('splats on top of a crate it comes down onto', () => {
    const { world, log, player } = thornwoodRace(CRATE);
    standOn(player, 7, 4);
    step(world, log, 1, THROW_RIGHT);
    stepUntilSettled(world, log);

    expect(landings(log)).toEqual([{ x: expect.any(Number), y: 4 * TILE }]);
  });

  it('falls into a pit and ends once it leaves the level, never splatting', () => {
    const { world, log, player } = thornwoodRace(PIT);
    standOn(player, 6, 4);
    step(world, log, 1, THROW_RIGHT);
    stepUntilSettled(world, log);

    expect(eventsIn(log, 'twist.launched', 'twist.landed', 'twist.ended').map((event) => event.type)).toEqual([
      'twist.launched',
      'twist.ended',
    ]);
    expect(world.twists).toEqual([]);
  });

  it('dries 5 s after it splats', () => {
    const { world, log, player } = thornwoodRace(FLOOR);
    standOn(player, 7, 4);
    step(world, log, 1, THROW_RIGHT);
    step(world, log, 400, IDLE);
    const [landedAt] = ticksOf(log, 'twist.landed');
    const [endedAt] = ticksOf(log, 'twist.ended');

    expect((endedAt ?? 0) - (landedAt ?? 0)).toBe(MUD_PIE_TUNING.dryTicks);
    expect(world.twists).toEqual([]);
  });
});

describe('a mud patch', () => {
  it('slows a runner but its thrower to mud speed while it stands in it', () => {
    const clear = speedAtPatch(null);

    expect(speedAtPatch('tess')).toBeCloseTo(clear * MUD_SPEED_MUL, 0);
  });

  it('never slows its own thrower', () => {
    expect(speedAtPatch('player')).toBe(speedAtPatch(null));
  });

  it('never slows a human on Easy when a rival threw it', () => {
    expect(speedAtPatch('tess', 'easy')).toBe(speedAtPatch(null, 'easy'));
  });
});

describe('a rival holding a mud pie', () => {
  /** Whether Tess, on the floor at col 7 facing right, wants to throw with the player standing `tiles` ahead. */
  function wantsWithPlayerAhead(tiles: number, difficulty: Difficulty = 'hard'): boolean {
    const { world, log, player } = thornwoodRace(FLOOR, difficulty);
    const tess = racerOf(world, 'tess');
    standOn(tess, 7, 4);
    standOn(player, 7 + tiles, 4);
    // One tick settles both on the floor, so each counts as on the ground.
    step(world, log, 1, IDLE);
    return twistRules('mudPie').rivalWants(world, tess, { x: 1, y: 0 });
  }

  it('throws at a racer standing 3 to 10 tiles ahead, and not nearer or farther', () => {
    expect([2, 3, 10, 11].map((tiles) => wantsWithPlayerAhead(tiles))).toEqual([false, true, true, false]);
  });

  it('never throws at a human on Easy', () => {
    expect(wantsWithPlayerAhead(6, 'easy')).toBe(false);
  });
});
