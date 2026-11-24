/**
 * Black holes: a drifter whose centre crosses a horizon is swallowed, waits out of play, and comes
 * back at rest where it last flew free of every hole's reach. Raced through `createWorld` on an
 * open room with the rivals walled off, so a rival meets a hole only when a test puts it there.
 */
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../events.ts';
import { isSolid } from '../../level/query.ts';
import { centreOf } from '../../racers.ts';
import { isDowned } from '../../status.ts';
import { giveItems, hold, IDLE, placeOnTile, racerOf, step } from '../../test-world.ts';
import { type Racer, type RacerId, TILE, type Vec, type WellDef } from '../../types.ts';
import { effectiveTuning } from '../index.ts';
import { driftWorld, RIVAL_LANE_ROWS, ticksOfRacer } from './test-kit.ts';
import { driftExtras } from './tuning.ts';

/** An open room 40 tiles wide with 13 open rows and a stardust on the hole's tile; the player starts in its left column. */
const ROOM = [
  '#'.repeat(40),
  ...Array.from({ length: 13 }, (_, row) => {
    if (row === 6) return `#1${'.'.repeat(18)}o${'.'.repeat(18)}F`;
    return `#${'.'.repeat(38)}F`;
  }),
  '#'.repeat(40),
];
/** The player-area row the player starts on and the holes sit on, and that row in the level. */
const ROW = 7;
const LEVEL_ROW = ROW + RIVAL_LANE_ROWS;
const HOLE: WellDef = { col: 20, row: ROW, reach: 4, pull: 300, horizon: 1.5 };
const PLANET: WellDef = { col: 20, row: ROW, reach: 4, pull: 300 };
/** A tile on the hole's row well outside its reach. */
const FREE_COL = 8;

const centreOfWell = (well: WellDef): Vec => ({ x: (well.col + 0.5) * TILE, y: (LEVEL_ROW + 0.5) * TILE });
const distance = (a: Vec, b: Vec) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

function roomWith(...wells: WellDef[]) {
  const made = driftWorld(ROOM, { wells });
  const { respawnTicks, respawnInvulnTicks } = driftExtras(effectiveTuning(made.world));
  return { ...made, respawnTicks, respawnInvulnTicks };
}

type Respawned = Extract<GameEvent, { type: 'racer.respawned' }>;

/** Where `id` came back, from its `racer.respawned` events, in order. */
function respawnsOf(log: ReturnType<typeof roomWith>['log'], id: RacerId = 'player'): Respawned[] {
  return log
    .all()
    .filter((event): event is Respawned & typeof event => event.type === 'racer.respawned' && event.id === id);
}

/** The centre of a racer-sized body whose top-left is `spot`. */
const centreAt = (racer: Racer, spot: Vec): Vec => ({ x: spot.x + racer.body.w / 2, y: spot.y + racer.body.h / 2 });

describe('a black hole', () => {
  it('swallows a racer whose centre is inside its horizon, on that tick', () => {
    const { world, log, player, respawnTicks } = roomWith(HOLE);
    placeOnTile(player, HOLE.col, LEVEL_ROW);
    step(world, log, 1, IDLE);

    expect(ticksOfRacer(log, 'racer.fell')).toEqual([world.tick]);
    expect(player.status.fallen).toBe(respawnTicks);
    expect(isDowned(player)).toBe(true);
  });

  it('leaves alone a racer inside its reach and outside its horizon', () => {
    const { world, log, player } = roomWith(HOLE);
    placeOnTile(player, HOLE.col - 3, LEVEL_ROW);
    step(world, log, 1, IDLE);

    expect(ticksOfRacer(log, 'racer.fell')).toEqual([]);
  });

  it('holds the swallowed racer at rest where it went in until it respawns', () => {
    const { world, log, player, respawnTicks } = roomWith(HOLE);
    placeOnTile(player, HOLE.col, LEVEL_ROW);
    step(world, log, 1, IDLE);
    const parked = { x: player.body.x, y: player.body.y };
    step(world, log, respawnTicks - 1, IDLE);

    expect(player.status.fallen).toBe(1);
    expect(player.body).toMatchObject({ ...parked, vx: 0, vy: 0 });
    expect(ticksOfRacer(log, 'racer.respawned')).toEqual([]);
  });

  it('puts it back after respawnTicks, at rest and invulnerable, where it last flew free', () => {
    const { world, log, player, respawnTicks, respawnInvulnTicks } = roomWith(HOLE);
    placeOnTile(player, FREE_COL, LEVEL_ROW);
    step(world, log, 1, IDLE);
    const free = { x: player.body.x, y: player.body.y };
    placeOnTile(player, HOLE.col, LEVEL_ROW);
    step(world, log, 1, IDLE);
    const fellAt = world.tick;
    step(world, log, respawnTicks, IDLE);

    expect(ticksOfRacer(log, 'racer.respawned')).toEqual([fellAt + respawnTicks]);
    expect(respawnsOf(log)[0]).toMatchObject(free);
    expect(player.body).toMatchObject({ ...free, vx: 0, vy: 0 });
    expect(player.status.fallen).toBe(0);
    expect(player.status.invulnerable).toBe(respawnInvulnTicks - 1);
  });

  it('puts back a racer that flew in on its own outside the reach and clear of rock, and does not take it again', () => {
    const { world, log, player, respawnTicks } = roomWith(HOLE);
    placeOnTile(player, HOLE.col - 6, LEVEL_ROW);
    player.body.vx = 150;
    step(world, log, 120, IDLE);

    expect(ticksOfRacer(log, 'racer.fell')).toHaveLength(1);

    step(world, log, respawnTicks + 180, IDLE);
    const back = respawnsOf(log)[0];
    const centre = back ? centreAt(player, back) : { x: 0, y: 0 };

    expect(back).toBeDefined();
    expect(distance(centre, centreOfWell(HOLE))).toBeGreaterThanOrEqual(HOLE.reach * TILE);
    expect(isSolid(world.level, world.broken, Math.floor(centre.x / TILE), Math.floor(centre.y / TILE))).toBe(false);
    expect(ticksOfRacer(log, 'racer.fell')).toHaveLength(1);
  });

  it.each([
    [
      'invulnerable',
      (racer: Racer) => {
        racer.status.invulnerable = 300;
      },
    ],
    [
      'cannonballing',
      (racer: Racer) => {
        racer.status.cannonball = 300;
      },
    ],
    [
      'driven by an item dash',
      (racer: Racer) => {
        racer.status.dashing = 300;
        racer.dashDir = { x: 1, y: 0 };
        racer.dashSpeed = 200;
      },
    ],
  ])('swallows a racer that is %s', (_name, prepare) => {
    const { world, log, player } = roomWith(HOLE);
    placeOnTile(player, HOLE.col, LEVEL_ROW);
    prepare(player);
    step(world, log, 1, IDLE);

    expect(ticksOfRacer(log, 'racer.fell')).toEqual([world.tick]);
  });

  it('swallows a racer that fires a Comet inside its reach once, even with the stick held away afterwards', () => {
    const { world, log, player, respawnTicks } = roomWith(HOLE);
    giveItems(player, ['cannonball']);
    // Last free just outside the reach, then fired at the hole from just outside the horizon.
    placeOnTile(player, HOLE.col - HOLE.reach - 1, LEVEL_ROW);
    step(world, log, 1, IDLE);
    placeOnTile(player, HOLE.col - 2, LEVEL_ROW);
    step(world, log, 1, hold({ x: 1, y: 0 }, { use: true }));
    const away = hold({ x: -1, y: 0 });
    step(world, log, 40, away);

    expect(ticksOfRacer(log, 'item.used')).toHaveLength(1);
    expect(ticksOfRacer(log, 'racer.fell')).toHaveLength(1);

    step(world, log, respawnTicks + 60, away);

    expect(ticksOfRacer(log, 'racer.respawned')).toHaveLength(1);
    expect(ticksOfRacer(log, 'racer.fell')).toHaveLength(1);
  });

  it('puts a racer back at rest with no dash, Comet, latched probe or Tractor Beam still running', () => {
    const { world, log, player, respawnTicks } = roomWith(HOLE);
    placeOnTile(player, HOLE.col, LEVEL_ROW);
    player.status.dashing = 300;
    player.dashDir = { x: 1, y: 0 };
    player.dashSpeed = 200;
    player.status.cannonball = 300;
    player.status.inflated = 300;
    player.status.latched = 300;
    player.status.undertow = 300;
    step(world, log, respawnTicks + 1, IDLE);

    expect(ticksOfRacer(log, 'racer.respawned')).toHaveLength(1);
    expect(player.status).toMatchObject({ dashing: 0, cannonball: 0, inflated: 0, latched: 0, undertow: 0 });
    expect(player.body).toMatchObject({ vx: 0, vy: 0 });
  });

  it('lets a swallowed racer collect nothing while it is out', () => {
    const { world, log, player, respawnTicks } = roomWith(HOLE);
    placeOnTile(player, HOLE.col, LEVEL_ROW);
    step(world, log, respawnTicks, IDLE);

    expect(ticksOfRacer(log, 'racer.fell')).toHaveLength(1);
    expect(ticksOfRacer(log, 'pearl.collected')).toEqual([]);
    expect(player.pearls).toBe(0);
  });

  it('swallows a rival by the same rule and puts it back', () => {
    const { world, log, respawnTicks } = roomWith(HOLE);
    const tess = racerOf(world, 'tess');
    placeOnTile(tess, FREE_COL, LEVEL_ROW);
    step(world, log, 1, IDLE);
    placeOnTile(tess, HOLE.col, LEVEL_ROW);
    step(world, log, 1, IDLE);
    const fellAt = world.tick;
    step(world, log, respawnTicks, IDLE);

    expect(ticksOfRacer(log, 'racer.fell', 'tess')).toEqual([fellAt]);
    expect(ticksOfRacer(log, 'racer.respawned', 'tess')).toEqual([fellAt + respawnTicks]);
  });

  it('puts a racer back outside both reaches when two holes overlap', () => {
    const near: WellDef = { ...HOLE, col: 18 };
    const far: WellDef = { ...HOLE, col: 23 };
    const { world, log, player, respawnTicks } = roomWith(near, far);
    placeOnTile(player, FREE_COL, LEVEL_ROW);
    step(world, log, 1, IDLE);
    // Between the two, inside both reaches and outside both horizons, flying at the far one.
    placeOnTile(player, 20, LEVEL_ROW);
    player.body.vx = 150;
    step(world, log, 60, IDLE);

    expect(ticksOfRacer(log, 'racer.fell')).toHaveLength(1);

    step(world, log, respawnTicks, IDLE);
    const back = respawnsOf(log)[0];
    const centre = back ? centreAt(player, back) : { x: 0, y: 0 };

    expect(back).toBeDefined();
    expect(distance(centre, centreOfWell(near))).toBeGreaterThanOrEqual(near.reach * TILE);
    expect(distance(centre, centreOfWell(far))).toBeGreaterThanOrEqual(far.reach * TILE);
  });
});

describe('a planet', () => {
  it('never swallows a racer, even one at its centre', () => {
    const { world, log, player } = roomWith(PLANET);
    placeOnTile(player, PLANET.col, LEVEL_ROW);
    step(world, log, 60, IDLE);

    expect(ticksOfRacer(log, 'racer.fell')).toEqual([]);
    expect(centreOf(player).x).toBeGreaterThan(0);
  });
});
