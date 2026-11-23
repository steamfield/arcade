import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { flashAround } from '../hazards/contacts.ts';
import { centreOf } from '../racers.ts';
import { eventsIn, placeOnTile, raceOn, racerOf, tileCentre } from '../test-world.ts';
import type { RacerId, World } from '../types.ts';
import { fireBurst } from './burst.ts';
import { advanceDecoys, popDecoy, spawnDecoy } from './decoys.ts';

/** A long open pool with the finish at the right end. */
const POOL = `
  ###############################
  #1............................#
  #2............................#
  #3............................#
  #4...........................F#
  ###############################
`;

/** A wall across rows 1 to 3 at column 11, open only along the bottom row. */
const DETOUR = `
  ###############################
  #1.........#..................#
  #2.........#..................#
  #3.........#..................#
  #4...........................F#
  ###############################
`;

const RIGHT = { x: 1, y: 0 };

/** The player with a decoy out at tile (10, 2), the other racers parked far away on the left. */
function decoyAt(column = 10, bubbled = false) {
  const { world, log } = raceOn(POOL);
  const player = racerOf(world, 'player');
  placeOnTile(player, column, 2);
  spawnDecoy(world, player, bubbled);
  for (const [id, row] of [
    ['tess', 1],
    ['squib', 3],
    ['bo', 4],
  ] as const)
    placeOnTile(racerOf(world, id), 1, row);
  return { world, log, player };
}

/** The world's only decoy. */
function decoyOf(world: World) {
  const decoy = world.decoys[0];
  if (!decoy) throw new Error('the world has no decoy');
  return decoy;
}

function ticks(world: World, count: number) {
  for (let i = 0; i < count; i++) advanceDecoys(world, TICK_DT);
}

describe('dropping a decoy', () => {
  it('appears at the owner, which keeps its Mimic Octopus', () => {
    const { world, log } = raceOn(POOL);
    const player = racerOf(world, 'player');
    player.stack = ['mimic'];

    fireBurst(world, player, RIGHT);

    expect(world.decoys).toEqual([{ ...centreOf(player), vx: 0, vy: 0, ttl: 300, owner: 'player' }]);
    expect(eventsIn(log, 'decoy.spawned')).toEqual([{ type: 'decoy.spawned', owner: 'player' }]);
    expect(player.stack).toEqual(['mimic']);
  });

  it('replaces the owner’s earlier decoy, which pops', () => {
    const { world, log, player } = decoyAt();

    spawnDecoy(world, player, false);

    expect(world.decoys).toHaveLength(1);
    expect(eventsIn(log, 'decoy.popped')).toEqual([{ type: 'decoy.popped', owner: 'player', by: null, trapped: null }]);
  });
});

describe('a decoy swimming', () => {
  it('swims on toward the finish at 80 px/s', () => {
    const { world } = decoyAt();
    const start = decoyOf(world).x;

    ticks(world, 30);

    expect(decoyOf(world).x - start).toBeCloseTo(40, 0);
    expect(decoyOf(world).y).toBeCloseTo(tileCentre(10, 2).y, 0);
  });

  it('swims round rock the way a racer would', () => {
    const { world, log } = raceOn(DETOUR);
    const player = racerOf(world, 'player');
    placeOnTile(player, 9, 2);
    spawnDecoy(world, player, false);
    for (const [id, row] of [
      ['tess', 1],
      ['squib', 3],
      ['bo', 4],
    ] as const)
      placeOnTile(racerOf(world, id), 1, row);

    ticks(world, 200);

    expect(eventsIn(log, 'decoy.popped')).toEqual([]);
    expect(decoyOf(world).x).toBeGreaterThan(13 * 16);
  });

  it('pops, unhit, after 300 ticks', () => {
    const { world, log } = decoyAt(2);

    ticks(world, 299);
    expect(world.decoys).toHaveLength(1);
    ticks(world, 1);

    expect(world.decoys).toEqual([]);
    expect(eventsIn(log, 'decoy.popped')).toEqual([{ type: 'decoy.popped', owner: 'player', by: null, trapped: null }]);
  });

  it('is gone when it crosses the finish line', () => {
    const { world, log } = decoyAt(10);
    decoyOf(world).x = world.level.finishX * 16 - 0.1;

    ticks(world, 2);

    expect(world.decoys).toEqual([]);
    expect(eventsIn(log, 'decoy.popped')).toEqual([{ type: 'decoy.popped', owner: 'player', by: null, trapped: null }]);
  });
});

describe('popping a decoy', () => {
  it('a racer other than its owner touching it pops it', () => {
    const { world, log } = decoyAt();
    placeOnTile(racerOf(world, 'tess'), 10, 2);

    ticks(world, 1);

    expect(world.decoys).toEqual([]);
    expect(eventsIn(log, 'decoy.popped')).toEqual([
      { type: 'decoy.popped', owner: 'player', by: 'tess', trapped: null },
    ]);
    expect(racerOf(world, 'tess').status.trapped).toBe(0);
  });

  it('its owner swimming through it does not', () => {
    const { world, player } = decoyAt();
    placeOnTile(player, 10, 2);

    ticks(world, 3);

    expect(world.decoys).toHaveLength(1);
  });

  it('a bubble from another racer pops it and is used up; its owner’s own bubble flies through', () => {
    const { world, log } = decoyAt();
    const at = decoyOf(world);
    world.bubbles = [{ x: at.x, y: at.y, vx: 0, vy: 0, ttl: 90, owner: 'player', seeking: false }];
    ticks(world, 1);
    expect(world.decoys).toHaveLength(1);
    expect(world.bubbles).toHaveLength(1);

    world.bubbles = [{ x: at.x, y: at.y, vx: 0, vy: 0, ttl: 90, owner: 'bo', seeking: false }];
    ticks(world, 1);

    expect(world.decoys).toEqual([]);
    expect(world.bubbles).toEqual([]);
    expect(eventsIn(log, 'decoy.popped')).toEqual([{ type: 'decoy.popped', owner: 'player', by: 'bo', trapped: null }]);
  });

  it('a lantern flash within 4 tiles pops it; the owner’s own flash does not', () => {
    const own = decoyAt();
    flashAround(own.world, own.player);
    expect(own.world.decoys).toHaveLength(1);

    const other = decoyAt();
    placeOnTile(racerOf(other.world, 'tess'), 13, 2);
    flashAround(other.world, racerOf(other.world, 'tess'));
    expect(other.world.decoys).toEqual([]);
    expect(eventsIn(other.log, 'decoy.popped')).toEqual([
      { type: 'decoy.popped', owner: 'player', by: 'tess', trapped: null },
    ]);

    const far = decoyAt();
    placeOnTile(racerOf(far.world, 'tess'), 20, 2);
    flashAround(far.world, racerOf(far.world, 'tess'));
    expect(far.world.decoys).toHaveLength(1);
  });

  it('a bubbled decoy traps whoever pops it, however they do', () => {
    const touched = decoyAt(10, true);
    placeOnTile(racerOf(touched.world, 'tess'), 10, 2);
    ticks(touched.world, 1);

    const flashed = decoyAt(10, true);
    placeOnTile(racerOf(flashed.world, 'tess'), 12, 2);
    flashAround(flashed.world, racerOf(flashed.world, 'tess'));

    for (const { world, log } of [touched, flashed]) {
      expect(world.decoys).toEqual([]);
      expect(racerOf(world, 'tess').status.trapped).toBe(60);
      expect(eventsIn(log, 'racer.trapped')).toEqual([{ type: 'racer.trapped', id: 'tess', by: 'player' }]);
      expect(eventsIn(log, 'decoy.popped')).toEqual([
        { type: 'decoy.popped', owner: 'player', by: 'tess', trapped: 'tess' },
      ]);
    }
  });

  it('a bubbled decoy that simply expires traps nobody', () => {
    const { world, log } = decoyAt(2, true);

    ticks(world, 300);

    expect(world.decoys).toEqual([]);
    expect(eventsIn(log, 'racer.trapped')).toEqual([]);
  });

  it('does not trap a racer whose shield absorbs the bubble: the shield pops instead', () => {
    const { world, log } = decoyAt(10, true);
    const tess = racerOf(world, 'tess');
    tess.stack = ['bubbleShield'];

    popDecoy(world, decoyOf(world), 'tess' as RacerId);

    expect(tess.status.trapped).toBe(0);
    expect(eventsIn(log, 'decoy.popped')).toEqual([
      { type: 'decoy.popped', owner: 'player', by: 'tess', trapped: null },
    ]);
    expect(eventsIn(log, 'shield.popped')).toEqual([{ type: 'shield.popped', id: 'tess' }]);
  });
});
