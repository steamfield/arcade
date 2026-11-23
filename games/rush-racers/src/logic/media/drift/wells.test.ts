/**
 * What gravity wells do to a drifter: the pull its surroundings report, how that pull moves it,
 * the tighter turn a planet on the inside of a bend gives, and what wells leave alone. Raced
 * through `createWorld` on an open room, or on a bare drifter where only the physics matters.
 */
import { TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { pullAt } from '../../level/wells.ts';
import { spawnLoose } from '../../pickups/loose.ts';
import { centreOf } from '../../racers.ts';
import { hold, IDLE, placeAt, step } from '../../test-world.ts';
import { type Difficulty, TILE, type Vec, type WellDef } from '../../types.ts';
import { effectiveTuning } from '../index.ts';
import { sampleDriftEnvironment } from './env.ts';
import { bareDrifter, drift, driftWorld, RIVAL_LANE_ROWS, ticksIn, VACUUM } from './test-kit.ts';
import { DRIFT_TUNING, driftExtras } from './tuning.ts';

const { drag, maxSpeed } = DRIFT_TUNING;
const { cruise } = DRIFT_TUNING.extra;
const RIGHT: Vec = { x: 1, y: 0 };
const DOWN: Vec = { x: 0, y: 1 };

/** An open room 40 tiles wide with 13 open rows; the player starts in its left column, mid height. */
const ROOM = [
  '#'.repeat(40),
  ...Array.from({ length: 13 }, (_, row) => `#${row === 6 ? '1' : '.'}${'.'.repeat(37)}F`),
  '#'.repeat(40),
];
/** A planet with no body in the middle of the room: pull only, so a racer can cross it. */
const PLANET: WellDef = { col: 20, row: 7, reach: 7, pull: 200 };
/** The planet's centre in world pixels. */
const CENTRE: Vec = { x: (PLANET.col + 0.5) * TILE, y: (PLANET.row + RIVAL_LANE_ROWS + 0.5) * TILE };

const roomWith = (wells: readonly WellDef[], difficulty: Difficulty = 'hard') =>
  driftWorld(ROOM, { wells, difficulty });

describe("a drifter's surroundings", () => {
  it('report the pull of the wells at its centre, times the tuning wellPull', () => {
    const { world, player } = roomWith([PLANET]);
    placeAt(player, { x: CENTRE.x + 40, y: CENTRE.y - 24 });
    const { wellPull } = driftExtras(effectiveTuning(world));
    const raw = pullAt(world.level, centreOf(player));
    const { pull } = sampleDriftEnvironment(world, player);

    expect(raw.x).toBeLessThan(0);
    expect(raw.y).toBeGreaterThan(0);
    expect(pull.x).toBeCloseTo(raw.x * wellPull, 6);
    expect(pull.y).toBeCloseTo(raw.y * wellPull, 6);
  });

  it('report no pull outside every reach', () => {
    const { world, player } = roomWith([PLANET]);

    expect(sampleDriftEnvironment(world, player).pull).toEqual({ x: 0, y: 0 });
  });

  it('report a pull on Easy that is 0.6 of the pull on Hard', () => {
    const at = { x: CENTRE.x - 48, y: CENTRE.y };
    const pullOn = (difficulty: Difficulty) => {
      const { world, player } = roomWith([PLANET], difficulty);
      placeAt(player, at);
      return sampleDriftEnvironment(world, player).pull.x;
    };

    expect(pullOn('hard')).toBeGreaterThan(0);
    expect(pullOn('easy')).toBeCloseTo(pullOn('hard') * 0.6, 6);
  });
});

describe('the pull on a drifter', () => {
  it('starts an idle racer at rest moving toward the centre at the pull less drag', () => {
    const { world, log, player } = roomWith([PLANET]);
    placeAt(player, { x: CENTRE.x + 56, y: CENTRE.y });
    const { idleBrake } = driftExtras(effectiveTuning(world));
    const pull = -sampleDriftEnvironment(world, player).pull.x;
    step(world, log, 1, IDLE);

    expect(pull).toBeCloseTo(PLANET.pull / 2, 6);
    expect(player.body.vx).toBeCloseTo(-(pull - drag - idleBrake) * TICK_DT, 4);
    expect(player.body.vy).toBeCloseTo(0, 6);
  });

  it('takes a racer over cruise, and never past maxSpeed', () => {
    const env = { ...VACUUM, pull: { x: 900, y: 0 } };
    const { samples } = drift(bareDrifter(), ticksIn(2), hold(RIGHT), { env });
    const speeds = samples.map((sample) => sample.speed);

    expect(Math.max(...speeds)).toBeGreaterThan(cruise + 40);
    expect(Math.max(...speeds)).toBeLessThanOrEqual(maxSpeed + 1e-6);
  });

  it('does nothing to a racer trapped in a bubble', () => {
    const { world, log, player } = roomWith([PLANET]);
    const at = { x: CENTRE.x + 40, y: CENTRE.y + 24 };
    placeAt(player, at);
    player.status.trapped = 1000;
    step(world, log, 30, IDLE);

    expect(centreOf(player).x).toBeCloseTo(at.x, 6);
    expect(centreOf(player).y).toBeCloseTo(at.y, 6);
  });

  it('does nothing to a loose item', () => {
    const { world, log } = roomWith([PLANET]);
    spawnLoose(world, 'puffer', 1, { x: CENTRE.x + 40, y: CENTRE.y + 24 });
    step(world, log, 30, IDLE);

    expect(world.loose[0]).toMatchObject({ x: CENTRE.x + 40, y: CENTRE.y + 24 });
  });
});

describe('a planet on the inside of a turn', () => {
  /** Tiles the racer must get below where it began its turn. */
  const DROP_TILES = 6;

  /**
   * A racer at cruise heading right, four tiles above the planet's centre and just short of it,
   * holds Down until it is `DROP_TILES` lower: how long that took, how far right it swung past
   * where it began, and its speed at the end.
   */
  function turnDown(wells: readonly WellDef[]) {
    const { world, log, player } = roomWith(wells);
    const from = { x: CENTRE.x - 10, y: CENTRE.y - 4 * TILE };
    placeAt(player, from);
    player.body.vx = cruise;
    let swing = 0;
    let ticks = 0;
    while (centreOf(player).y < from.y + DROP_TILES * TILE && ticks < 600) {
      step(world, log, 1, hold(DOWN));
      swing = Math.max(swing, centreOf(player).x - from.x);
      ticks++;
    }
    return { ticks, swing, speed: Math.sqrt(player.body.vx * player.body.vx + player.body.vy * player.body.vy) };
  }

  it('swings the racer round at least two tiles tighter, no slower, and still at speed', () => {
    const open = turnDown([]);
    const swung = turnDown([PLANET]);

    expect(open.ticks).toBeLessThan(600);
    expect(swung.swing).toBeLessThanOrEqual(open.swing - 2 * TILE);
    expect(swung.ticks).toBeLessThanOrEqual(open.ticks);
    expect(swung.speed).toBeGreaterThanOrEqual(cruise * 0.9);
  });
});
