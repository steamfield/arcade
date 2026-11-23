import { describe, expect, it } from 'vitest';
import { centreOf } from '../racers.ts';
import { eventsIn, giveItems, IDLE, placeOnTile, raceOn, racerOf, step, tileCentre } from '../test-world.ts';
import { advanceRiptides, feltCurrent, riptideCurrentAt } from './riptides.ts';
import { fireItem } from './use.ts';

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
  giveItems(player, ['riptide']);
  return { world, log, player };
}

describe('laying a lane', () => {
  it('runs from the racer along the aim, 8 tiles long and 2 wide, centred on it', () => {
    const { world, log, player } = holdingRiptide();
    placeOnTile(player, 11, 3);

    fireItem(world, player, 0, RIGHT);

    const centre = centreOf(player);
    expect(world.riptides).toEqual([
      { x: centre.x, y: centre.y - 16, w: 128, h: 32, dir: RIGHT, ttl: 180, owner: 'player' },
    ]);
    expect(eventsIn(log, 'riptide.spawned')).toEqual([{ type: 'riptide.spawned', owner: 'player' }]);
    expect(player.items[0]).toEqual({ kind: 'riptide', charges: 1 });
  });

  it('snaps a slanted aim to its stronger axis, in either direction', () => {
    const horizontal = holdingRiptide();
    placeOnTile(horizontal.player, 20, 3);
    const upward = holdingRiptide();
    placeOnTile(upward.player, 20, 4);

    fireItem(horizontal.world, horizontal.player, 0, { x: -0.9, y: 0.4 });
    fireItem(upward.world, upward.player, 0, { x: 0.2, y: -0.98 });

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

    fireItem(world, player, 0, RIGHT);

    const [lane] = world.riptides;
    expect((lane?.x ?? 0) + (lane?.w ?? 0)).toBeLessThanOrEqual(9 * 16);
    expect((lane?.x ?? 0) + (lane?.w ?? 0)).toBeGreaterThan(9 * 16 - 8 - 1);
  });

  it('lays nothing with a wall right in front', () => {
    const { world, log, player } = holdingRiptide();
    placeOnTile(player, 8, 2);

    fireItem(world, player, 0, RIGHT);

    expect(world.riptides).toEqual([]);
    expect(eventsIn(log, 'riptide.spawned')).toEqual([]);
  });

  it('fades after 180 ticks', () => {
    const { world, player } = holdingRiptide();
    fireItem(world, player, 0, RIGHT);

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

  it('pushes twice as hard as a plain current, along the lane', () => {
    const { world } = raceOn(POOL);
    const player = racerOf(world, 'player');
    world.riptides.push({ x: 160, y: 40, w: 128, h: 32, dir: RIGHT, ttl: 180, owner: 'tess' });

    placeOnTile(player, 12, 3);

    expect(riptideCurrentAt(world, player.body)).toEqual({ x: 2, y: 0 });
  });
});

describe("a selected Riptide's passive", () => {
  const swept = (kinds: ('riptide' | 'jetFin')[]) => {
    const { world, log } = raceOn(CURRENT);
    for (const id of ['tess', 'squib', 'bo'] as const) racerOf(world, id).status.stunned = 100_000;
    const player = racerOf(world, 'player');
    giveItems(player, kinds);
    placeOnTile(player, 3, 2);
    step(world, log, 30, IDLE);
    return player.body.x - tileCentre(3, 2).x;
  };

  it('feels a tile current 1.5 times as hard, only while the Riptide is selected', () => {
    const { world } = raceOn(CURRENT);
    const player = racerOf(world, 'player');
    giveItems(player, ['riptide']);

    expect(feltCurrent(world, player, { x: 1, y: 0 })).toEqual({ x: 1.5, y: 0 });
    expect(feltCurrent(world, player, null)).toBeNull();
    giveItems(player, ['jetFin', 'riptide']);
    expect(feltCurrent(world, player, { x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
  });

  it('is carried further along a current than a racer without one', () => {
    expect(swept(['riptide']) / swept([])).toBeGreaterThan(1.5);
  });

  it('feels a lane 1.5 times as hard as well', () => {
    const { world } = raceOn(POOL);
    const player = racerOf(world, 'player');
    giveItems(player, ['riptide']);
    placeOnTile(player, 12, 3);
    world.riptides.push({ x: 160, y: 40, w: 128, h: 32, dir: RIGHT, ttl: 180, owner: 'tess' });

    expect(feltCurrent(world, player, null)).toEqual({ x: 3, y: 0 });
  });
});
