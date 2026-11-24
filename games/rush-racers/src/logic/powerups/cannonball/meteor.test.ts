/**
 * Cloudreach's Meteor: fired from the Cannonball slot, it marks the leader other than its owner,
 * shadows them, locks on for its last ticks, then falls and hits whoever is under it. Raced through
 * `createWorld` and `stepRace` on a small inline Cloudreach sky where every slot is a person standing
 * still, so nobody moves unless a test moves them.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { courseFromLevel, eventsIn, giveItems, hold, IDLE, placeOnTile, racerOf } from '../../test-world.ts';
import { type Difficulty, type Finish, RACER_IDS, type RacerId, TILE, type TickInput } from '../../types.ts';
import { createWorld, stepRace } from '../../world.ts';
import { groundBelow, METEOR, METEOR_TUNING, skyTopAbove } from './meteor.ts';

/** The floor's top edge, px: row 9 is the floor. */
const FLOOR_Y = 9 * TILE;

/**
 * A Cloudreach sky 40 columns wide, flown left to right: a ceiling on row 0, open sky on rows 1-8, a
 * floor on row 9 with a puff cloud (C) set into it at column 30, and the finish on column 39.
 */
const SKY = [
  '#'.repeat(40),
  ...Array.from({ length: 7 }, () => `#${'.'.repeat(37)}F#`),
  `#1.2.3.4${'.'.repeat(30)}F#`,
  `${'#'.repeat(30)}C${'#'.repeat(9)}`,
].join('\n');

/** The tile row racers stand on in SKY and TOWER, just over the floor. */
const STANDING_ROW = 8;

/** SKY with a two-column tower (cols 24-25) rising from the floor to row 5. */
const TOWER = [
  '#'.repeat(40),
  ...Array.from({ length: 4 }, () => `#${'.'.repeat(37)}F#`),
  ...Array.from({ length: 3 }, () => `#${'.'.repeat(23)}##${'.'.repeat(12)}F#`),
  `#1.2.3.4${'.'.repeat(16)}##${'.'.repeat(12)}F#`,
  '#'.repeat(40),
].join('\n');

/**
 * A taller sky, 24 rows, with a block hanging from the ceiling over cols 22-34 down to row 18, so
 * under it is a low covered stretch (rows 19-22) with open sky behind it. Racers stand on row 22.
 */
const COVERED = [
  '#'.repeat(40),
  ...Array.from({ length: 18 }, () => `#${'.'.repeat(21)}${'#'.repeat(13)}...F#`),
  ...Array.from({ length: 3 }, () => `#${'.'.repeat(37)}F#`),
  `#1.2.3.4${'.'.repeat(30)}F#`,
  '#'.repeat(40),
].join('\n');

/**
 * A racing Cloudreach world on `ascii`, racers placed on `standingRow`. On Hard every slot is a
 * person (so nobody moves on their own); Easy allows only the player, so its rivals fly.
 */
function meteorRace(difficulty: Difficulty = 'hard', ascii = SKY, standingRow = STANDING_ROW) {
  const log = new EventLog<GameEvent>(100_000);
  const course = courseFromLevel({ name: 'meteor', ascii }, 'flight', { world: 'cloudreach', theme: 'sky' });
  const humans = difficulty === 'hard' ? RACER_IDS : (['player'] as const);
  const world = createWorld(course, log, { seed: 1, endsWhen: 'everyone', difficulty, humans });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  const at = (id: RacerId, col: number) => placeOnTile(racerOf(world, id), col, standingRow);
  /** Steps `ticks` ticks with every person idle except any `inputs` given. */
  const run = (ticks: number, inputs: Partial<Record<RacerId, TickInput>> = {}) => {
    for (let tick = 0; tick < ticks; tick++) {
      log.tick = world.tick + 1;
      stepRace(world, { player: IDLE, tess: IDLE, squib: IDLE, bo: IDLE, ...inputs }, TICK_DT);
    }
  };
  /** One tick in which `id` fires the Meteor it holds. */
  const fire = (id: RacerId) => run(1, { [id]: hold({ x: 0, y: 0 }, { use: true }) });
  return { world, log, at, run, fire };
}

/** Ticks from the firing tick until the meteor has surely landed: the warning, then a fall from the ceiling to the floor. */
const UNTIL_LANDED = METEOR_TUNING.warnTicks + 20;

/** Every racer hit by a meteor, by id. */
function meteorHits(log: EventLog<GameEvent>): RacerId[] {
  return eventsIn(log, 'racer.hit').flatMap((event) =>
    event.type === 'racer.hit' && event.cause === 'meteor' ? [event.id] : [],
  );
}

/** The shot events, without stamps. */
const shotEvents = (log: EventLog<GameEvent>) => eventsIn(log, 'shot.launched', 'shot.warned', 'shot.ended');

describe('who a meteor marks', () => {
  it('marks the leader, not its owner, and spends the charge', () => {
    const { world, log, at, run, fire } = meteorRace();
    at('player', 10);
    at('tess', 4);
    at('squib', 20);
    at('bo', 14);
    run(1);
    giveItems(racerOf(world, 'player'), ['cannonball']);
    fire('player');
    expect(shotEvents(log)).toEqual([
      { type: 'shot.launched', owner: 'player', style: 'meteor', target: 'squib' },
      { type: 'shot.warned', owner: 'player', style: 'meteor', target: 'squib' },
    ]);
    expect(racerOf(world, 'player').items.every((item) => item === null)).toBe(true);
  });

  it('marks the racer in second when its owner leads', () => {
    const { world, at, run, fire } = meteorRace();
    at('player', 25);
    at('tess', 4);
    at('squib', 20);
    at('bo', 14);
    run(1);
    giveItems(racerOf(world, 'player'), ['cannonball']);
    fire('player');
    expect(world.shots.map((shot) => shot.target)).toEqual(['squib']);
  });

  it('fizzles at its owner with nobody to mark, still spending the charge', () => {
    const { world, log, at, run, fire } = meteorRace();
    at('player', 10);
    run(1);
    const finish: Finish = { tick: 100, place: 1, overshoot: 0 };
    racerOf(world, 'tess').finished = finish;
    racerOf(world, 'squib').status.fallen = 30;
    racerOf(world, 'bo').status.fallen = 30;
    giveItems(racerOf(world, 'player'), ['cannonball']);
    const owner = racerOf(world, 'player').body;
    fire('player');
    expect(shotEvents(log)).toEqual([
      { type: 'shot.ended', owner: 'player', style: 'meteor', reason: 'fizzled', x: owner.x + owner.w / 2, y: owner.y + owner.h / 2 },
    ]);
    expect(world.shots).toEqual([]);
    expect(racerOf(world, 'player').items.every((item) => item === null)).toBe(true);
  });

  it("never marks a human with an Easy rival's meteor, which goes to the best placed rival instead", () => {
    const { world } = meteorRace('easy');
    const [player, tess, squib, bo] = RACER_IDS.map((id) => racerOf(world, id));
    if (!player || !tess || !squib || !bo) throw new Error('four racers');
    [player.place, squib.place, tess.place, bo.place] = [1, 2, 3, 4];
    METEOR.fire(world, tess, { x: 1, y: 0 });
    expect(world.shots.map((shot) => shot.target)).toEqual(['squib']);
    expect(METEOR.rivalWants(world, bo, { x: 1, y: 0 })).toBe(true);
    // With only the player ahead of it, an Easy rival has no use for a meteor.
    [player.place, tess.place, squib.place, bo.place] = [1, 2, 3, 4];
    expect(METEOR.rivalWants(world, tess, { x: 1, y: 0 })).toBe(false);
  });

  it('is wanted by a rival only when someone it may attack leads it', () => {
    const { world, at, run } = meteorRace();
    at('player', 20);
    at('tess', 10);
    at('squib', 4);
    at('bo', 6);
    run(1);
    expect(METEOR.rivalWants(world, racerOf(world, 'tess'), { x: 1, y: 0 })).toBe(true);
    expect(METEOR.rivalWants(world, racerOf(world, 'player'), { x: 1, y: 0 })).toBe(false);
  });
});

describe('where a meteor falls', () => {
  /** A Hard race with the player on column `col - 1` firing at squib, leading on column `col`, with bo and tess well behind. */
  function firedAt(col: number) {
    const race = meteorRace();
    race.at('player', col - 1);
    race.at('tess', 2);
    race.at('squib', col);
    race.at('bo', col - 6);
    race.run(1);
    giveItems(racerOf(race.world, 'player'), ['cannonball']);
    race.fire('player');
    return race;
  }

  it('hits everyone within 1.5 tiles of where it falls but its owner, and ends on the floor', () => {
    const { world, log, run, at } = firedAt(20);
    // Tess joins squib after the meteor has marked squib.
    at('tess', 21);
    run(UNTIL_LANDED);
    expect(meteorHits(log).sort()).toEqual(['squib', 'tess']);
    const ended = shotEvents(log).at(-1);
    expect(ended).toEqual({ type: 'shot.ended', owner: 'player', style: 'meteor', reason: 'landed', x: 20.5 * TILE, y: FLOOR_Y });
    expect(world.shots).toEqual([]);
  });

  it('falls only after its whole warning', () => {
    const { log, run } = firedAt(20);
    run(METEOR_TUNING.warnTicks - 1);
    expect(meteorHits(log)).toEqual([]);
    run(UNTIL_LANDED);
    expect(meteorHits(log)).toEqual(['squib']);
  });

  it('follows a target that moves before it locks on', () => {
    const { log, run, at } = firedAt(20);
    run(METEOR_TUNING.warnTicks - METEOR_TUNING.lockTicks - 10);
    at('squib', 26);
    run(UNTIL_LANDED);
    expect(meteorHits(log)).toEqual(['squib']);
  });

  it('misses a target that moves away once it has locked on', () => {
    const { log, run, at } = firedAt(20);
    run(METEOR_TUNING.warnTicks - METEOR_TUNING.lockTicks + 2);
    at('squib', 26);
    run(UNTIL_LANDED);
    expect(meteorHits(log)).toEqual([]);
    expect(shotEvents(log).at(-1)).toMatchObject({ type: 'shot.ended', x: 20.5 * TILE, y: FLOOR_Y });
  });

  it('leads a target flying steadily, so holding course is no dodge', () => {
    const { world, log, at, run } = meteorRace();
    const right = hold({ x: 1, y: 0 });
    at('player', 6);
    at('tess', 2);
    at('bo', 4);
    at('squib', 8);
    // Squib is up to cruise along the floor before the meteor is fired and keeps going.
    run(30, { squib: right });
    giveItems(racerOf(world, 'player'), ['cannonball']);
    run(1, { squib: right, player: hold({ x: 0, y: 0 }, { use: true }) });
    run(UNTIL_LANDED, { squib: right });
    expect(meteorHits(log)).toEqual(['squib']);
  });

  it('pops a puff cloud it lands on', () => {
    const { log, run } = firedAt(30);
    run(UNTIL_LANDED);
    expect(eventsIn(log, 'coral.broken')).toEqual([{ type: 'coral.broken', tx: 30, ty: 9, by: 'player' }]);
    expect(meteorHits(log)).toEqual(['squib']);
  });
});

describe('leading a flyer past cover', () => {
  /**
   * Squib flies right along the floor of `ascii` from column `start` for `warmUp` ticks, then the
   * player, far behind, fires a meteor at it; returns who the meteor hit once it has landed.
   */
  function steadyFlyerHits(ascii: string, standingRow: number, start: number, warmUp: number): RacerId[] {
    const { world, log, at, run } = meteorRace('hard', ascii, standingRow);
    const right = hold({ x: 1, y: 0 });
    at('player', 1);
    at('tess', 2);
    at('bo', 3);
    at('squib', start);
    run(warmUp, { squib: right });
    giveItems(racerOf(world, 'player'), ['cannonball']);
    run(1, { squib: right, player: hold({ x: 0, y: 0 }, { use: true }) });
    // The warning, then a fall from row 1 to the floor of the taller sky.
    run(METEOR_TUNING.warnTicks + 45, { squib: right });
    expect(world.shots, 'the meteor has landed').toEqual([]);
    return meteorHits(log);
  }

  it('hits a flyer heading into a tower, marking the open air in front of it rather than the tower', () => {
    // Squib is two tiles short of the tower at the lock, and stops against it before the meteor lands.
    expect(steadyFlyerHits(TOWER, STANDING_ROW, 12, 40)).toEqual(['squib']);
  });

  it('hits a flyer entering a covered stretch, leading it by the short fall from the roof', () => {
    // At the lock squib is still in the open, about to fly under the block.
    expect(steadyFlyerHits(COVERED, 22, 10, 20)).toEqual(['squib']);
  });

  it('falls onto the top of a tower marked inside it', () => {
    const { world } = meteorRace('hard', TOWER);
    const inTower = { x: 24.5 * TILE, y: 7.5 * TILE };
    expect(skyTopAbove(world, inTower.x, inTower.y)).toBe(TILE);
    expect(groundBelow(world, inTower.x, skyTopAbove(world, inTower.x, inTower.y))).toEqual({
      x: inTower.x,
      y: 5 * TILE,
    });
  });
});
