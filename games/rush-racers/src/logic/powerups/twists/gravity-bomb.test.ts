/**
 * Farside's Gas Bomb as a gravity bomb: dropped behind its owner, it pulls the racers near it in like
 * a planet for 4 s, never its owner and never a human its owner may not attack. Raced through
 * `createWorld` and `stepWorld` in a Farside room, with the pull read as drift feels it.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { driftEnv } from '../../media/drift/data.ts';
import { mediumOf } from '../../media/index.ts';
import { centreOf } from '../../racers.ts';
import {
  courseFromLevel,
  eventsIn,
  giveItems,
  hold,
  IDLE,
  placeAt,
  racerOf,
  step,
  ticksOf,
  tileCentre,
} from '../../test-world.ts';
import { type Difficulty, type Racer, type RacerId, TILE, type Twist, type Vec, type World } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { bombPullOn, GRAVITY_BOMB, GRAVITY_BOMB_TUNING } from './gravity-bomb.ts';

const WIDTH = 40;
const WALL = '#'.repeat(WIDTH);
/** The row the rivals start on, sealed off above the open room by a wall on row 2. */
const RIVAL_LANE = `#234${'.'.repeat(WIDTH - 5)}F`;
/** Open space with the finish on its right. */
const OPEN_ROW = `#${'.'.repeat(WIDTH - 2)}F`;
/** The rivals' lane on row 1, open space on rows 3-13, the player starting at (2, 8). */
const ROOM = [
  WALL,
  RIVAL_LANE,
  WALL,
  ...Array.from({ length: 11 }, (_, i) => (i === 5 ? `#.1${'.'.repeat(WIDTH - 4)}F` : OPEN_ROW)),
  WALL,
].join('\n');
/** Where the owner stands in most tests, facing right: the bomb lands one tile left of it. */
const OWNER_AT = tileCentre(20, 8);
const BOMB_AT = { x: OWNER_AT.x - TILE, y: OWNER_AT.y };
const { pull: BOMB_PULL, reachTiles, ttlTicks } = GRAVITY_BOMB_TUNING;
const REACH = reachTiles * TILE;

/** A racing world in Farside (so the Ink Sac is a gravity bomb) on ROOM, the player at OWNER_AT. */
function farside(difficulty: Difficulty = 'hard') {
  const course = courseFromLevel({ name: 'gravity bomb', ascii: ROOM }, 'drift', { world: 'farside' });
  const log = new EventLog<GameEvent>(100_000);
  const world = createWorld(course, log, { seed: 1, endsWhen: 'everyone', difficulty });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  const player = racerOf(world, 'player');
  placeAt(player, OWNER_AT);
  player.facing = 1;
  return { world, log, player };
}

/** `owner` drops a gravity bomb where it stands, as using its Gas Bomb would. */
function dropBomb(world: World, owner: Racer): Twist {
  GRAVITY_BOMB.fire(world, owner, { x: owner.facing, y: 0 });
  const bomb = world.twists.at(-1);
  if (!bomb) throw new Error('firing the gravity bomb put nothing in world.twists');
  return bomb;
}

/** What drift's surroundings pull `racer` with this tick, px/s². */
const feltPull = (world: World, racer: Racer): Vec => driftEnv(mediumOf(world).sampleEnvironment(world, racer)).pull;

/** The pull a bomb's centre puts on a racer `distance` px from it, by the planet rule. */
const expectedPull = (distance: number) => BOMB_PULL * (1 - distance / REACH);

describe('using the Gas Bomb in Farside', () => {
  it('drops a gravity bomb one tile behind its owner, at rest, instead of an ink cloud', () => {
    const { world, log, player } = farside();
    giveItems(player, ['inkSac']);
    step(world, log, 1, hold({ x: 0, y: 0 }, { use: true }));

    expect(eventsIn(log, 'twist.launched')).toEqual([
      { type: 'twist.launched', owner: 'player', style: 'gravityBomb' },
    ]);
    expect(eventsIn(log, 'ink.spawned')).toEqual([]);
    expect(world.inks).toEqual([]);
    expect(world.twists).toEqual([
      { style: 'gravityBomb', owner: 'player', ...BOMB_AT, vx: 0, vy: 0, ttl: ttlTicks - 1, phase: 0 },
    ]);
  });

  it('drops it on the other side of an owner facing left', () => {
    const { world, player } = farside();
    player.facing = -1;

    expect(dropBomb(world, player)).toMatchObject({ x: OWNER_AT.x + TILE, y: OWNER_AT.y });
  });
});

describe("a gravity bomb's pull", () => {
  it('points at the bomb and weakens linearly to nothing at its five-tile reach', () => {
    const { world, player } = farside();
    dropBomb(world, player);
    const rival = racerOf(world, 'tess');
    const pullFrom = (offset: Vec) => {
      placeAt(rival, { x: BOMB_AT.x + offset.x, y: BOMB_AT.y + offset.y });
      return bombPullOn(world, rival);
    };

    const right = pullFrom({ x: 2 * TILE, y: 0 });
    expect(right.x).toBeCloseTo(-expectedPull(2 * TILE), 6);
    expect(right.y).toBeCloseTo(0, 6);
    const below = pullFrom({ x: 0, y: 4 * TILE });
    expect(below.x).toBeCloseTo(0, 6);
    expect(below.y).toBeCloseTo(-expectedPull(4 * TILE), 6);
    const diagonal = pullFrom({ x: -3 * TILE, y: -4 * TILE });
    expect(diagonal.x).toBeCloseTo(expectedPull(5 * TILE) * 0.6, 6);
    expect(pullFrom({ x: 1, y: 0 }).x).toBeCloseTo(-expectedPull(1), 6);
    expect(pullFrom({ x: REACH - 1, y: 0 }).x).toBeLessThan(0);
    expect(pullFrom({ x: REACH, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(pullFrom({ x: 6 * TILE, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(pullFrom({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('is felt by a drifter on top of the wells, times the tuning wellPull, which Easy lowers', () => {
    const feltOn = (difficulty: Difficulty) => {
      const { world } = farside(difficulty);
      const owner = racerOf(world, 'tess');
      const pulled = racerOf(world, 'squib');
      placeAt(owner, OWNER_AT);
      owner.facing = 1;
      dropBomb(world, owner);
      placeAt(pulled, { x: BOMB_AT.x + 2 * TILE, y: BOMB_AT.y });
      return feltPull(world, pulled).x;
    };

    expect(feltOn('hard')).toBeCloseTo(-expectedPull(2 * TILE), 6);
    expect(feltOn('easy')).toBeCloseTo(-expectedPull(2 * TILE) * 0.6, 6);
  });

  it('draws an idle racer in toward the bomb', () => {
    const { world, log } = farside();
    const owner = racerOf(world, 'tess');
    placeAt(owner, tileCentre(30, 12));
    owner.facing = 1;
    const bomb = dropBomb(world, owner);
    // Off the bomb's row once it is down, so the owner drifting for the finish never bumps the player.
    placeAt(owner, tileCentre(3, 4));
    const player = racerOf(world, 'player');
    placeAt(player, { x: bomb.x + 3 * TILE, y: bomb.y });
    const startX = centreOf(player).x;
    step(world, log, 30, IDLE);

    expect(centreOf(player).x).toBeLessThan(startX - 4);
  });

  it('never pulls its owner, who coasts on as if it were not there', () => {
    const { world, log, player } = farside();
    giveItems(player, ['inkSac']);
    step(world, log, 1, hold({ x: 0, y: 0 }, { use: true }));

    expect(bombPullOn(world, player)).toEqual({ x: 0, y: 0 });
    expect(feltPull(world, player)).toEqual({ x: 0, y: 0 });
    step(world, log, 30, IDLE);
    expect(centreOf(player)).toEqual(OWNER_AT);
  });

  it('from a rival on Easy leaves the human alone but still pulls other rivals; on Hard it pulls the human too', () => {
    const pullsOn = (difficulty: Difficulty) => {
      const { world, player } = farside(difficulty);
      const owner = racerOf(world, 'tess');
      placeAt(owner, OWNER_AT);
      owner.facing = 1;
      dropBomb(world, owner);
      const other = racerOf(world, 'squib');
      placeAt(player, { x: BOMB_AT.x + 2 * TILE, y: BOMB_AT.y });
      placeAt(other, { x: BOMB_AT.x - 2 * TILE, y: BOMB_AT.y });
      return { human: bombPullOn(world, player).x < 0, rival: bombPullOn(world, other).x > 0 };
    };

    expect(pullsOn('easy')).toEqual({ human: false, rival: true });
    expect(pullsOn('hard')).toEqual({ human: true, rival: true });
  });

  it('from the human on Easy still pulls a rival', () => {
    const { world, player } = farside('easy');
    dropBomb(world, player);
    const rival = racerOf(world, 'tess');
    placeAt(rival, { x: BOMB_AT.x - 2 * TILE, y: BOMB_AT.y });

    expect(bombPullOn(world, rival).x).toBeCloseTo(expectedPull(2 * TILE), 6);
  });

  it('adds up when two bombs reach the same racer', () => {
    const { world, player } = farside();
    const first = dropBomb(world, player);
    const other = racerOf(world, 'tess');
    placeAt(other, { x: OWNER_AT.x + 2 * TILE, y: OWNER_AT.y });
    other.facing = -1;
    const second = dropBomb(world, other);
    const pulled = racerOf(world, 'squib');
    placeAt(pulled, { x: second.x, y: second.y - 2 * TILE });

    const pull = bombPullOn(world, pulled);
    // The second bomb is straight below it and the first down and to the left, so both pull it down.
    expect(second.x - first.x).toBe(4 * TILE);
    expect(pull.y).toBeGreaterThan(expectedPull(2 * TILE));
    expect(pull.x).toBeLessThan(0);
  });
});

describe("a gravity bomb's time", () => {
  it('ends after 4 s, once, where it sat, and pulls nothing after', () => {
    const { world, log, player } = farside();
    giveItems(player, ['inkSac']);
    step(world, log, 1, hold({ x: 0, y: 0 }, { use: true }));
    const rival = racerOf(world, 'tess');
    const fireTick = world.tick;
    step(world, log, ttlTicks - 2);

    expect(world.twists).toHaveLength(1);
    expect(eventsIn(log, 'twist.ended')).toEqual([]);

    step(world, log, 1);
    expect(eventsIn(log, 'twist.ended')).toEqual([
      { type: 'twist.ended', owner: 'player', style: 'gravityBomb', ...BOMB_AT },
    ]);
    // Fired on its first tick, it has spent one of its 240 already.
    expect(ticksOf(log, 'twist.ended')).toEqual([fireTick + ttlTicks - 1]);
    expect(world.twists).toEqual([]);
    placeAt(rival, { x: BOMB_AT.x + TILE, y: BOMB_AT.y });
    expect(bombPullOn(world, rival)).toEqual({ x: 0, y: 0 });

    step(world, log, 30);
    expect(eventsIn(log, 'twist.ended')).toHaveLength(1);
  });

  it('ends at once when dropped off the level', () => {
    const { world, log, player } = farside();
    placeAt(player, tileCentre(0, 8));
    dropBomb(world, player);
    step(world, log, 1);

    expect(world.twists).toEqual([]);
    expect(eventsIn(log, 'twist.ended')).toEqual([
      { type: 'twist.ended', owner: 'player', style: 'gravityBomb', x: tileCentre(0, 8).x - TILE, y: OWNER_AT.y },
    ]);
  });
});

describe('a rival choosing to drop the gravity bomb', () => {
  /**
   * Whether rival 'tess' at OWNER_AT wants it with `chaser` at `offset` from it, just behind it in the
   * race or just ahead; every other racer is far off and well ahead.
   */
  const wantsWith = (offset: Vec, behind: boolean, difficulty: Difficulty = 'hard', chaser: RacerId = 'squib') => {
    const { world } = farside(difficulty);
    const rival = racerOf(world, 'tess');
    world.racers.forEach((racer, index) => {
      placeAt(racer, tileCentre(3 + index, 12));
      racer.progress = 5;
    });
    placeAt(rival, OWNER_AT);
    rival.progress = 20;
    const target = racerOf(world, chaser);
    placeAt(target, { x: OWNER_AT.x + offset.x, y: OWNER_AT.y + offset.y });
    target.progress = behind ? 22 : 18;
    return GRAVITY_BOMB.rivalWants(world, rival, { x: 1, y: 0 });
  };

  it('wants it for a racer within 4 tiles behind, and not for one ahead or further back', () => {
    expect(wantsWith({ x: -3 * TILE, y: 0 }, true)).toBe(true);
    expect(wantsWith({ x: -2 * TILE, y: 2 * TILE }, true)).toBe(true);
    expect(wantsWith({ x: 2 * TILE, y: 0 }, false)).toBe(false);
    expect(wantsWith({ x: -5 * TILE, y: 0 }, true)).toBe(false);
  });

  it('on Easy does not want it for a human behind, whom its bomb would not pull', () => {
    expect(wantsWith({ x: -3 * TILE, y: 0 }, true, 'easy', 'player')).toBe(false);
    expect(wantsWith({ x: -3 * TILE, y: 0 }, true, 'hard', 'player')).toBe(true);
  });
});
