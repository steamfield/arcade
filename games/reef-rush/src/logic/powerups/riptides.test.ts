import { describe, expect, it } from 'vitest';
import { centreOf } from '../racers.ts';
import { eventsIn, IDLE, placeOnTile, raceOn, racerOf, step, tileCentre } from '../test-world.ts';
import { fireBurst } from './burst.ts';
import { advanceRiptides, feltCurrent, riptideCurrentAt } from './riptides.ts';

/** A long open pool, three rows deep, with a wall at the right end and a pillar in row 2 at column 9. */
const POOL = `
  ###############################
  #1............................#
  #2.......#....................#
  #3............................#
  #4...........................F#
  ###############################
`;

/** A level with a current band along row 2, for the holder's passive. */
const CURRENT = `
  ###############################
  #1............................#
  #2>>>>>>>>>>>>>>>>>>>>>>>>>>>F#
  #3............................#
  #4............................#
  ###############################
`;

const RIGHT = { x: 1, y: 0 };

function holdingRiptide(ascii = POOL) {
  const { world, log } = raceOn(ascii);
  const player = racerOf(world, 'player');
  player.stack = ['riptide'];
  return { world, log, player };
}

describe('laying a lane', () => {
  it('runs from the racer along the aim, 8 tiles long and 2 wide, centred on it', () => {
    const { world, log, player } = holdingRiptide();
    placeOnTile(player, 11, 3);

    fireBurst(world, player, RIGHT);

    const centre = centreOf(player);
    expect(world.riptides).toEqual([
      { x: centre.x, y: centre.y - 16, w: 128, h: 32, dir: RIGHT, ttl: 180, owner: 'player', strength: 2 },
    ]);
    expect(eventsIn(log, 'riptide.spawned')).toEqual([{ type: 'riptide.spawned', owner: 'player' }]);
    expect(player.stack).toEqual(['riptide']);
  });

  it('snaps a slanted aim to its stronger axis, in either direction', () => {
    const horizontal = holdingRiptide();
    placeOnTile(horizontal.player, 20, 3);
    const upward = holdingRiptide();
    placeOnTile(upward.player, 20, 4);

    fireBurst(horizontal.world, horizontal.player, { x: -0.9, y: 0.4 });
    fireBurst(upward.world, upward.player, { x: 0.2, y: -0.98 });

    const left = horizontal.world.riptides[0];
    const up = upward.world.riptides[0];
    expect(left).toMatchObject({ dir: { x: -1, y: 0 }, w: 128, h: 32 });
    expect(left?.x).toBeCloseTo(centreOf(horizontal.player).x - 128, 6);
    // Cut short by the ceiling, three and a half tiles above the racer.
    expect(up).toMatchObject({ dir: { x: 0, y: -1 }, w: 32, h: 56 });
  });

  it('is cut short at the first wall on its centre line', () => {
    const { world, player } = holdingRiptide();
    // The pillar in row 2 is 4 tiles right of tile (5, 2): the lane ends at its near face.
    placeOnTile(player, 5, 2);

    fireBurst(world, player, RIGHT);

    const [lane] = world.riptides;
    expect((lane?.x ?? 0) + (lane?.w ?? 0)).toBeLessThanOrEqual(9 * 16);
    expect((lane?.x ?? 0) + (lane?.w ?? 0)).toBeGreaterThan(9 * 16 - 8 - 1);
  });

  it('lays nothing with a wall right in front', () => {
    const { world, log, player } = holdingRiptide();
    placeOnTile(player, 8, 2);

    fireBurst(world, player, RIGHT);

    expect(world.riptides).toEqual([]);
    expect(eventsIn(log, 'riptide.spawned')).toEqual([]);
  });

  it('fades after 180 ticks', () => {
    const { world, player } = holdingRiptide();
    fireBurst(world, player, RIGHT);

    for (let i = 0; i < 179; i++) advanceRiptides(world);
    expect(world.riptides).toHaveLength(1);
    advanceRiptides(world);

    expect(world.riptides).toEqual([]);
  });
});

describe('riding a lane', () => {
  /** Where a racer holding nothing and swimming right is after `ticks`, with a lane over row 3 or not. */
  function ridden(lane: boolean, ticks = 60) {
    const { world, log } = raceOn(POOL);
    for (const id of ['tess', 'squib', 'bo'] as const) racerOf(world, id).status.stunned = 100_000;
    const player = racerOf(world, 'player');
    placeOnTile(player, 11, 3);
    if (lane) {
      world.riptides.push({
        ...tileCentre(11, 3),
        x: 11 * 16,
        y: 2 * 16 + 8,
        w: 128,
        h: 32,
        dir: RIGHT,
        ttl: 180,
        owner: 'tess',
      });
    }
    step(world, log, ticks, IDLE);
    return player.body.x - tileCentre(11, 3).x;
  }

  it('pushes whoever is inside, not only its owner', () => {
    expect(ridden(true) - ridden(false)).toBeGreaterThan(30);
  });

  it('drops anyone outside it back to the plain water', () => {
    const { world } = raceOn(POOL);
    world.riptides.push({ x: 160, y: 40, w: 128, h: 32, dir: RIGHT, ttl: 180, owner: 'tess' });
    const player = racerOf(world, 'player');

    placeOnTile(player, 11, 4);
    expect(riptideCurrentAt(world, player.body)).toBeNull();
    placeOnTile(player, 12, 3);
    expect(riptideCurrentAt(world, player.body)).not.toBeNull();
  });

  it('pushes with the lane strength: twice a plain current, or as the lane says', () => {
    const { world } = raceOn(POOL);
    const player = racerOf(world, 'player');
    world.riptides.push({ x: 160, y: 40, w: 128, h: 32, dir: RIGHT, ttl: 180, owner: 'tess' });
    world.riptides.push({ x: 160, y: 120, w: 128, h: 32, dir: { x: 0, y: -1 }, ttl: 180, owner: 'tess', strength: 3 });

    placeOnTile(player, 12, 3);
    const plain = riptideCurrentAt(world, player.body);
    placeOnTile(player, 12, 8);
    const strong = riptideCurrentAt(world, player.body);

    expect(plain).toEqual({ x: 2, y: 0 });
    expect(strong).toEqual({ x: 0, y: -3 });
  });
});

describe("a Riptide holder's passive", () => {
  const swept = (kinds: ('riptide' | 'jetFin')[]) => {
    const { world, log } = raceOn(CURRENT);
    for (const id of ['tess', 'squib', 'bo'] as const) racerOf(world, id).status.stunned = 100_000;
    const player = racerOf(world, 'player');
    player.stack = kinds;
    placeOnTile(player, 3, 2);
    step(world, log, 30, IDLE);
    return player.body.x - tileCentre(3, 2).x;
  };

  it('feels a tile current 1.5 times as hard', () => {
    const { world } = raceOn(CURRENT);
    const player = racerOf(world, 'player');
    player.stack = ['riptide'];

    expect(feltCurrent(world, player, { x: 1, y: 0 })).toEqual({ x: 1.5, y: 0 });
    expect(feltCurrent(world, player, null)).toBeNull();
    player.stack = [];
    expect(feltCurrent(world, player, { x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
  });

  it('is carried further along a current than a racer without one', () => {
    expect(swept(['riptide']) / swept([])).toBeGreaterThan(1.5);
  });

  it('feels a lane 1.5 times as hard as well', () => {
    const { world } = raceOn(POOL);
    const player = racerOf(world, 'player');
    player.stack = ['riptide'];
    placeOnTile(player, 12, 3);
    world.riptides.push({ x: 160, y: 40, w: 128, h: 32, dir: RIGHT, ttl: 180, owner: 'tess' });

    expect(feltCurrent(world, player, null)).toEqual({ x: 3, y: 0 });
  });
});
