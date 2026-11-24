import { describe, expect, it } from 'vitest';
import { LevelError } from '../level/level-error.ts';
import { mediumOf } from '../media/index.ts';
import { swimDistanceAt, swimNextTile } from '../media/swim/way.ts';
import { length, unit } from '../num.ts';
import { centreOf } from '../racers.ts';
import { hold, placeAt, placeOnTile, raceOn, racerOf, step, tileCentre } from '../test-world.ts';
import { TILE, type Vec, type WhirlpoolDef, type World } from '../types.ts';

const POOL: WhirlpoolDef = { col: 11, row: 7, radius: 4, spin: 1, push: 220 };
const RIGHT = hold({ x: 1, y: 0 });

function water(whirlpools: readonly WhirlpoolDef[] = [POOL]) {
  return {
    name: 'whirlpools',
    whirlpools,
    ascii: `
      #########################
      #......................F#
      #1.....................F#
      #......................F#
      #2.....................F#
      #......................F#
      #3.....................F#
      #......................F#
      #4.....................F#
      #......................F#
      #......................F#
      #......................F#
      #......................F#
      #......................F#
      #########################
    `,
  };
}

/** Keep the other slots at the line while the test drives one swimmer. */
function swim(whirlpools?: readonly WhirlpoolDef[]) {
  const race = raceOn(water(whirlpools));
  const racer = racerOf(race.world, 'player');
  for (const rival of race.world.racers) {
    if (rival !== racer) rival.finished = { tick: 1, place: rival.place, overshoot: 0 };
  }
  return { ...race, racer };
}

function distanceFromEye(world: World): number {
  const at = centreOf(racerOf(world, 'player'));
  const eye = tileCentre(POOL.col, POOL.row);
  return length(at.x - eye.x, at.y - eye.y);
}

describe('whirlpool course data', () => {
  it.each<{ pool: WhirlpoolDef; message: RegExp }>([
    { pool: { ...POOL, col: -1 }, message: /off the map/ },
    { pool: { ...POOL, row: 0 }, message: /open water/ },
    { pool: { ...POOL, radius: 1.9 }, message: /radius/ },
    { pool: { ...POOL, radius: 10.1 }, message: /radius/ },
    { pool: { ...POOL, radius: Number.NaN }, message: /radius/ },
    { pool: { ...POOL, push: 0 }, message: /push/ },
    { pool: { ...POOL, push: Number.POSITIVE_INFINITY }, message: /push/ },
    { pool: { ...POOL, push: 481 }, message: /push/ },
    { pool: { ...POOL, push: 1e200 }, message: /push/ },
  ])('locates invalid data ($message)', ({ pool, message }) => {
    expect(() => raceOn(water([pool]))).toThrow(LevelError);
    expect(() => raceOn(water([pool]))).toThrow(
      expect.objectContaining({ message: expect.stringMatching(message), row: pool.row, col: pool.col }),
    );
  });

  it('rejects a spin outside the two directions, including untyped course data', () => {
    const invalid = { ...POOL };
    Reflect.set(invalid, 'spin', 0);
    expect(() => raceOn(water([invalid]))).toThrow(LevelError);
    expect(() => raceOn(water([invalid]))).toThrow(
      expect.objectContaining({ message: expect.stringMatching(/spin/), row: POOL.row, col: POOL.col }),
    );
  });

  it('rejects overlapping discs but accepts touching rims', () => {
    const second = { ...POOL, col: 17, row: 7 };
    expect(() => raceOn(water([POOL, second]))).toThrow(LevelError);
    expect(() => raceOn(water([POOL, second]))).toThrow(
      expect.objectContaining({ message: expect.stringMatching(/overlap/), row: second.row, col: second.col }),
    );
    const touching = { ...second, col: 19 };
    expect(raceOn(water([POOL, touching])).world.level.whirlpools).toEqual([POOL, touching]);
  });
});

describe('swimming through a whirlpool', () => {
  it('pushes along each spin and inward, leaves the rim and outside alone, and eases near the eye', () => {
    const speed = (row: number, whirlpools: readonly WhirlpoolDef[]) => {
      const { world, log, racer } = swim(whirlpools);
      placeOnTile(racer, POOL.col, row);
      step(world, log, 1, RIGHT);
      return { x: racer.body.vx, y: racer.body.vy };
    };
    const plain = speed(5, []);
    const clockwise = speed(5, [POOL]);
    const counterclockwise = speed(5, [{ ...POOL, spin: -1 }]);

    expect(clockwise.x).toBeGreaterThan(plain.x);
    expect(counterclockwise.x).toBeLessThan(plain.x);
    expect(clockwise.y).toBeGreaterThan(plain.y);
    expect(speed(2, [POOL])).toEqual(speed(2, []));
    expect(speed(3, [POOL])).toEqual(speed(3, []));
    expect(speed(7, [POOL]).x - plain.x).toBeLessThan((clockwise.x - plain.x) / 10);
  });

  it('swims faster than cruise with the spin and slower against it', () => {
    const speed = (row: number, whirlpools: readonly WhirlpoolDef[]) => {
      const { world, log, racer } = swim(whirlpools);
      placeOnTile(racer, POOL.col - 1, row);
      step(world, log, 24, RIGHT);
      return racer.body.vx;
    };

    expect(speed(5, [POOL])).toBeGreaterThan(speed(5, []) * 1.5);
    expect(speed(9, [POOL])).toBeLessThan(speed(9, []) * 0.5);
  });

  it('comes out of the forward side ahead of a swimmer cruising clear of the rim', () => {
    const rider = swim();
    const bypass = swim();
    placeOnTile(rider.racer, 6, 5);
    placeOnTile(bypass.racer, 6, 2);
    const beyond = tileCentre(POOL.col + POOL.radius, POOL.row).x;
    for (let ticks = 0; ticks < 150 && centreOf(rider.racer).x < beyond; ticks++) {
      step(rider.world, rider.log, 1, RIGHT);
      step(bypass.world, bypass.log, 1, RIGHT);
    }

    expect(centreOf(rider.racer).x).toBeGreaterThanOrEqual(beyond);
    expect(centreOf(rider.racer).x - centreOf(bypass.racer).x).toBeGreaterThan(TILE);
    expect(rider.racer.body.vx).toBeGreaterThan(bypass.racer.body.vx + 10);
  });

  it.each([
    { push: 220, trackEye: false },
    { push: 480, trackEye: true },
  ])('lets a full-force outward swim escape from any side at push $push', ({ push, trackEye }) => {
    const eye = tileCentre(POOL.col, POOL.row);
    const directions: Vec[] = [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
    ];
    const rim = POOL.radius * TILE;
    for (const direction of directions.map(unit)) {
      for (const start of [0, 0.05, 0.25, 0.5, 0.75, 0.98]) {
        const { world, log, racer } = swim([{ ...POOL, push }]);
        placeAt(racer, { x: eye.x + direction.x * rim * start, y: eye.y + direction.y * rim * start });
        for (let ticks = 0; ticks < 105 && distanceFromEye(world) < rim; ticks++) {
          // At the strongest allowed push, adjust the heading as the flow carries the swimmer round.
          const at = centreOf(racer);
          const outward =
            trackEye && (at.x !== eye.x || at.y !== eye.y) ? { x: at.x - eye.x, y: at.y - eye.y } : direction;
          step(world, log, 1, hold(outward));
        }
        expect(
          distanceFromEye(world),
          `start ${start}, direction ${direction.x},${direction.y}`,
        ).toBeGreaterThanOrEqual(rim);
      }
    }
  });

  it('emits on the tick of entry, stays quiet while inside and emits again after leaving', () => {
    const { world, log, racer } = swim();
    const eye = tileCentre(POOL.col, POOL.row);
    const beforeRim = { x: eye.x - POOL.radius * TILE - 0.5, y: eye.y };
    placeAt(racer, beforeRim);
    step(world, log, 1, RIGHT);
    expect(log.all().filter((event) => event.type === 'whirlpool.caught')).toEqual([]);

    racer.body.vx = 90;
    step(world, log, 15, RIGHT);
    placeAt(racer, beforeRim);
    step(world, log, 1, RIGHT);
    racer.body.vx = 90;
    step(world, log, 1, RIGHT);

    expect(log.all().filter((event) => event.type === 'whirlpool.caught')).toEqual([
      expect.objectContaining({ tick: 2, racer: 'player', pool: 0 }),
      expect.objectContaining({ tick: 18, racer: 'player', pool: 0 }),
    ]);
  });

  it('leaves fallen, trapped and finished racers alone and carries stunned invulnerable racers', () => {
    const speed = (whirlpools: readonly WhirlpoolDef[], status: 'fallen' | 'trapped' | 'finished' | 'hit') => {
      const { world, log, racer } = swim(whirlpools);
      placeOnTile(racer, POOL.col, POOL.row - 2);
      if (status === 'finished') racer.finished = { tick: 1, place: 1, overshoot: 0 };
      else if (status === 'hit') {
        racer.status.stunned = 30;
        racer.status.invulnerable = 30;
      } else racer.status[status] = 30;
      step(world, log);
      return racer.body.vx;
    };

    for (const status of ['fallen', 'trapped', 'finished'] as const) {
      expect(speed([POOL], status)).toBe(speed([], status));
    }
    expect(speed([POOL], 'hit')).toBeGreaterThan(speed([], 'hit'));
  });

  it('announces a swimmer floating into the pool in a bubble without changing the bubble drift', () => {
    const rider = swim();
    const calm = swim([]);
    const eye = tileCentre(POOL.col, POOL.row);
    for (const race of [rider, calm]) {
      race.racer.status.trapped = 30;
      placeAt(race.racer, { x: eye.x, y: eye.y + POOL.radius * TILE + 0.2 });
      step(race.world, race.log);
    }
    expect(rider.racer.body).toEqual(calm.racer.body);
    expect(rider.log.all().filter((event) => event.type === 'whirlpool.caught')).toMatchObject([
      { racer: 'player', pool: 0, tick: 1 },
    ]);
    step(rider.world, rider.log, 4);
    expect(rider.log.all().filter((event) => event.type === 'whirlpool.caught')).toHaveLength(1);
  });
});

it('makes the rival steer field favour the side that flows toward the finish for each spin', () => {
  const clockwise = raceOn(water()).world;
  const reversed = raceOn(water([{ ...POOL, spin: -1 }])).world;
  const above = { x: 8, y: 5 };
  const below = { x: 8, y: 9 };
  const approach = { x: 7, y: 7 };

  expect(swimDistanceAt(clockwise, above)).toBeLessThan(swimDistanceAt(clockwise, below));
  expect(swimDistanceAt(reversed, below)).toBeLessThan(swimDistanceAt(reversed, above));
  const lineAtEye = (world: World) => {
    let tile = approach;
    for (let steps = 0; steps < 8 && tile.x < POOL.col; steps++) {
      const move = swimNextTile(world, tile);
      if (!move) break;
      tile = { x: tile.x + move.x, y: tile.y + move.y };
    }
    expect(tile.x).toBe(POOL.col);
    return tile.y;
  };
  expect(lineAtEye(clockwise)).toBeLessThan(POOL.row);
  expect(lineAtEye(reversed)).toBeGreaterThan(POOL.row);
});

it('reports the directional steer price through the swim medium', () => {
  const { world } = raceOn(water());
  const medium = mediumOf(world);
  const forwardSide = { x: POOL.col, y: POOL.row - 2 };
  expect(medium.enterCost('water', false, { x: 1, y: 0 }, forwardSide, world.level)).toBeLessThan(1);
  expect(medium.enterCost('water', false, { x: -1, y: 0 }, forwardSide, world.level)).toBeGreaterThan(1);
});

it('takes the cheaper diagonal exit when a straight exit crosses the counterflow', () => {
  const def = water();
  const { world, log } = raceOn({ ...def, ascii: def.ascii.replaceAll('..........F#', 'F..........#') });
  const rival = racerOf(world, 'tess');
  placeOnTile(rival, 12, 10);
  const before = centreOf(rival);

  step(world, log);
  expect(centreOf(rival).y - before.y).toBeGreaterThan(0.02);
  expect(swimNextTile(world, { x: 12, y: 10 })).toEqual({ x: 1, y: 1 });
});
