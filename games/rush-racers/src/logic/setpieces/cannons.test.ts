import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../events.ts';
import { LevelError } from '../level/level-error.ts';
import { flightDistanceAt, flightNextTile } from '../media/flight/way.ts';
import { centreOf } from '../racers.ts';
import {
  courseFromLevel,
  eventsIn,
  hold,
  IDLE,
  placeAt,
  placeOnTile,
  racerOf,
  step,
  tileCentre,
} from '../test-world.ts';
import { type CannonDef, type LevelDef, TILE } from '../types.ts';
import { createWorld, stepRace } from '../world.ts';

const SKY = `
  ####################
  #.2...............F#
  #.3...............F#
  #.4...............F#
  #.................F#
  #.1...............F#
  ####################
`;

const CANNON_TILE: CannonDef = { col: 5, row: 5, dir: [1, -1], speed: 600, flightTicks: 8 };
const HOLD_TICKS = 18;
const RELOAD_TICKS = 60;

function race(cannons: readonly CannonDef[], ascii = SKY, pieces: Pick<LevelDef, 'asteroids'> = {}, allHuman = true) {
  const log = new EventLog<GameEvent>(10_000);
  const course = courseFromLevel({ ascii, name: 'cannon test', cannons, ...pieces }, 'flight');
  const world = createWorld(course, log, {
    difficulty: 'hard',
    seed: 1,
    endsWhen: 'everyone',
    ...(allHuman ? { humans: ['player', 'tess', 'squib', 'bo'] } : {}),
  });
  world.race = { phase: 'racing', raceTick: 0, rivalsDoneAt: null, result: null, endsWhen: 'everyone' };
  const player = racerOf(world, 'player');
  function advance(ticks = 1, input = IDLE) {
    if (!allHuman) {
      step(world, log, ticks, input);
      return;
    }
    for (let i = 0; i < ticks; i++) {
      log.tick = world.tick + 1;
      stepRace(world, { player: input, tess: IDLE, squib: IDLE, bo: IDLE }, TICK_DT);
    }
  }
  return { world, log, player, advance };
}

describe('parsing cloud cannons', () => {
  const invalid: { name: string; patch: Partial<CannonDef>; message: RegExp }[] = [
    {
      name: 'off the map',
      patch: { col: 20 },
      message:
        /^Cannon 0 tile: expected integer coordinates in cols 0–19 and rows 0–6, got \(20, 5\) at row 5, col 20$/,
    },
    { name: 'on a solid tile', patch: { row: 6 }, message: /^Cannon 0 tile: expected an open tile, got rock at / },
    { name: 'a zero aim', patch: { dir: [0, 0] }, message: /^Cannon 0 direction: expected .*?, got \[0,0\] at / },
    // Runtime course data can disagree with its TypeScript definition.
    {
      name: 'aim outside -1..1',
      patch: JSON.parse('{"dir":[2,0]}'),
      message: /direction: expected .*?, got \[2,0\] at /,
    },
    {
      name: 'missing aim components',
      patch: JSON.parse('{"dir":null}'),
      message: /direction: expected .*?, got null at /,
    },
    {
      name: 'extra aim components',
      patch: JSON.parse('{"dir":[1,0,2]}'),
      message: /direction: expected .*?, got \[1,0,2\] at /,
    },
    { name: 'speed below range', patch: { speed: 0 }, message: /speed: expected 60–1200 px\/s, got 0 at / },
    { name: 'speed above range', patch: { speed: 1201 }, message: /speed: expected 60–1200 px\/s, got 1201 at / },
    {
      name: 'flight below range',
      patch: { flightTicks: 0 },
      message: /flightTicks: expected an integer in 1–120, got 0 at /,
    },
    {
      name: 'flight above range',
      patch: { flightTicks: 121 },
      message: /flightTicks: expected an integer in 1–120, got 121 at /,
    },
    {
      name: 'fractional flight',
      patch: { flightTicks: 1.5 },
      message: /flightTicks: expected an integer in 1–120, got 1\.5 at /,
    },
  ];
  it.each(invalid)('rejects $name at its tile', ({ patch, message }) => {
    const cannon = { ...CANNON_TILE, ...patch };
    expect(() => race([cannon])).toThrow(LevelError);
    expect(() => race([cannon])).toThrow(
      expect.objectContaining({ row: cannon.row, col: cannon.col, message: expect.stringMatching(message) }),
    );
  });

  it('rejects two cannons on one tile', () => {
    expect(() => race([CANNON_TILE, { ...CANNON_TILE, dir: [1, 0] }])).toThrow(
      expect.objectContaining({
        name: 'LevelError',
        row: 5,
        col: 5,
        message: 'Cannon 1 tile: expected an unclaimed tile, got a tile already claimed by a cannon at row 5, col 5',
      }),
    );
  });
});

describe('riding a cloud cannon', () => {
  it('catches on entry, holds still, then moves along its normalized aim for the full flight', () => {
    const { world, player, log, advance } = race([CANNON_TILE]);
    const centre = tileCentre(5, 5);
    placeAt(player, { x: 5 * TILE - 1, y: centre.y });
    player.body.vx = 120;
    expect(eventsIn(log, 'cannon.loaded')).toEqual([]);
    advance();
    expect(eventsIn(log, 'cannon.loaded')).toEqual([{ type: 'cannon.loaded', racer: 'player', cannon: 0 }]);
    expect(centreOf(player)).toEqual(centre);
    expect(player.body).toMatchObject({ vx: 0, vy: 0 });

    advance(HOLD_TICKS - 1, hold({ x: -1, y: -1 }, { kick: true }));
    expect(eventsIn(log, 'cannon.fired', 'racer.flapped', 'racer.kicked')).toEqual([]);
    expect(centreOf(player)).toEqual(centre);
    expect(player.body).toMatchObject({ vx: 0, vy: 0 });
    advance(1, hold({ x: -1, y: 1 }, { kick: true }));
    expect(eventsIn(log, 'cannon.fired')).toEqual([{ type: 'cannon.fired', racer: 'player', cannon: 0 }]);
    const speed = CANNON_TILE.speed / Math.sqrt(2);
    expect(player.body.vx).toBeCloseTo(speed);
    expect(player.body.vy).toBeCloseTo(-speed);
    expect(centreOf(player).x).toBeCloseTo(centre.x + speed * TICK_DT);

    advance(CANNON_TILE.flightTicks - 1, hold({ x: -1, y: -1 }, { kick: true }));
    expect(eventsIn(log, 'racer.flapped', 'racer.kicked')).toEqual([]);
    expect(centreOf(player).x).toBeCloseTo(centre.x + speed * TICK_DT * CANNON_TILE.flightTicks);
    expect(centreOf(player).y).toBeCloseTo(centre.y - speed * TICK_DT * CANNON_TILE.flightTicks);
    expect(world.cannonRides).toMatchObject([{ flight: 0, reload: RELOAD_TICKS }]);
    advance();
    expect(player.body.vy).toBeGreaterThan(-speed);
  });

  it('ends the flight when the body hits a wall and blocks recapture for the reload', () => {
    const sky = SKY.replace('#.1...............F#', '#.1...#...........F#');
    const { world, player, log, advance } = race([{ ...CANNON_TILE, dir: [1, 0], flightTicks: 30 }], sky);
    placeOnTile(player, 5, 5);
    advance(HOLD_TICKS + 1);
    expect(player.body.x + player.body.w).toBeCloseTo(6 * TILE);
    expect(player.body.vx).toBe(0);
    expect(world.cannonRides).toMatchObject([{ flight: 0, reload: RELOAD_TICKS }]);
    advance(RELOAD_TICKS - 1);
    expect(eventsIn(log, 'cannon.loaded')).toHaveLength(1);
    advance();
    expect(eventsIn(log, 'cannon.loaded')).toHaveLength(2);
  });

  it('holds different racers at different cannons on the same tick', () => {
    const second = { ...CANNON_TILE, col: 8, row: 3, dir: [1, 0] } satisfies CannonDef;
    const { world, player, log, advance } = race([CANNON_TILE, second]);
    const tess = racerOf(world, 'tess');
    placeOnTile(player, 5, 5);
    placeOnTile(tess, 8, 3);
    advance();
    expect(eventsIn(log, 'cannon.loaded')).toEqual([
      { type: 'cannon.loaded', racer: 'player', cannon: 0 },
      { type: 'cannon.loaded', racer: 'tess', cannon: 1 },
    ]);
    expect(centreOf(tess)).toEqual(tileCentre(8, 3));
    advance(HOLD_TICKS);
    expect(eventsIn(log, 'cannon.fired')).toHaveLength(2);
    expect(tess.body.vx).toBe(second.speed);
    expect(tess.body.vy).toBe(0);
  });

  it('chains into a second cannon midway through the first shot', () => {
    const first = { ...CANNON_TILE, dir: [1, 0], speed: 480, flightTicks: 16 } satisfies CannonDef;
    const second = { ...first, col: 9, dir: [0, -1] } satisfies CannonDef;
    const { world, player, log, advance } = race([first, second], SKY, {}, false);
    placeOnTile(player, 5, 5);
    advance(HOLD_TICKS + 7);
    expect(eventsIn(log, 'cannon.loaded')).toEqual([
      { type: 'cannon.loaded', racer: 'player', cannon: 0 },
      { type: 'cannon.loaded', racer: 'player', cannon: 1 },
    ]);
    expect(centreOf(player)).toEqual(tileCentre(9, 5));
    expect(world.cannonRides).toMatchObject([
      { flight: 0, reload: RELOAD_TICKS },
      { held: HOLD_TICKS, reload: 0 },
    ]);
    advance(HOLD_TICKS);
    expect(player.body.vy).toBe(-second.speed);
  });

  it('keeps flying while its centre is still inside the barrel that fired it', () => {
    const slow = { ...CANNON_TILE, dir: [1, 0], speed: 60 } satisfies CannonDef;
    const { world, player, log, advance } = race([slow], SKY, {}, false);
    placeOnTile(player, 5, 5);
    advance(HOLD_TICKS + 1);

    expect(centreOf(player).x).toBe(tileCentre(5, 5).x + 1);
    expect(eventsIn(log, 'cannon.loaded')).toHaveLength(1);
    expect(world.cannonRides).toMatchObject([{ held: 0, flight: slow.flightTicks - 1, reload: 0 }]);
  });

  it('records the finish without snapping a shot to a barrel on the line', () => {
    const first = { ...CANNON_TILE, dir: [1, 0], speed: 480, flightTicks: 30 } satisfies CannonDef;
    const second = { ...first, col: 18 };
    const { world, player, log, advance } = race([first, second], SKY, {}, false);
    placeOnTile(player, first.col, first.row);
    advance(HOLD_TICKS + 25);

    expect(centreOf(player).x).toBe(world.level.finishX * TILE);
    expect(player.finished).toMatchObject({ overshoot: 0 });
    expect(eventsIn(log, 'cannon.loaded')).not.toContainEqual({ type: 'cannon.loaded', racer: 'player', cannon: 1 });
  });

  it.each(['finished', 'fallen', 'trapped'] as const)('leaves a %s racer alone', (status) => {
    const { player, log, advance } = race([CANNON_TILE]);
    placeOnTile(player, 5, 5);
    if (status === 'finished') player.finished = { tick: 0, place: 1, overshoot: 0 };
    else player.status[status] = 30;
    advance();
    expect(eventsIn(log, 'cannon.loaded')).toEqual([]);
  });

  it('takes a normal stun while held and still fires on schedule', () => {
    const { player, log, advance } = race([CANNON_TILE], SKY, {
      asteroids: [{ from: [3, 5], to: [5, 5], periodTicks: 60, offsetTicks: 14, radius: 0.4 }],
    });
    placeOnTile(player, 5, 5);
    advance();
    expect(eventsIn(log, 'racer.hit')).toEqual([]);
    // The moving hazard reaches the cannon only after the racer has been caught.
    advance(HOLD_TICKS - 1);
    expect(eventsIn(log, 'racer.hit')).toContainEqual({ type: 'racer.hit', id: 'player', cause: 'asteroid', by: null });
    expect(player.status.stunned).toBeGreaterThan(0);
    expect(centreOf(player)).toEqual(tileCentre(5, 5));
    expect(player.body).toMatchObject({ vx: 0, vy: 0 });
    advance();
    expect(eventsIn(log, 'cannon.fired')).toHaveLength(1);
    expect(player.body.vx).toBeGreaterThan(400);
  });

  it('falls out during a downward shot over open sky and respawns above solid ground', () => {
    const sky = SKY.replace(/#{20}(?=\s*$)/, '#####.##############');
    const { player, log, advance } = race([{ ...CANNON_TILE, dir: [0, 1], speed: 600, flightTicks: 100 }], sky);
    placeOnTile(player, 5, 5);
    advance(HOLD_TICKS + 6);
    expect(eventsIn(log, 'racer.fell')).toContainEqual({ type: 'racer.fell', id: 'player' });
    advance(60);
    expect(eventsIn(log, 'racer.respawned')).toContainEqual(expect.objectContaining({ id: 'player' }));
    expect(player.body.y).toBeLessThan(6 * TILE);
  });

  it('ends a shot when drift swallows the racer and leaves it parked to respawn', () => {
    const log = new EventLog<GameEvent>();
    const cannon = { ...CANNON_TILE, row: 3, dir: [1, 0], speed: 480, flightTicks: 30 } satisfies CannonDef;
    const course = courseFromLevel(
      {
        ascii: SKY,
        name: 'cannon aimed through a black hole',
        cannons: [cannon],
        wells: [{ col: 9, row: 3, reach: 2, horizon: 0.75, pull: 100 }],
      },
      'drift',
    );
    const world = createWorld(course, log, { seed: 1 });
    world.race.phase = 'racing';
    const player = racerOf(world, 'player');
    placeOnTile(player, cannon.col, cannon.row);
    step(world, log, HOLD_TICKS + 7);

    expect(eventsIn(log, 'racer.fell')).toContainEqual({ type: 'racer.fell', id: 'player' });
    expect(world.cannonRides).toMatchObject([{ flight: 0, reload: RELOAD_TICKS }]);
    const parked = centreOf(player);
    step(world, log);
    expect(centreOf(player)).toEqual(parked);
    step(world, log, player.status.fallen);
    expect(eventsIn(log, 'racer.respawned')).toContainEqual(expect.objectContaining({ id: 'player' }));
  });

  it("does not carry a runner's jump grace period through the hold and shot", () => {
    const log = new EventLog<GameEvent>();
    const course = courseFromLevel({ ascii: SKY, name: 'cannon over a floor', cannons: [CANNON_TILE] }, 'run');
    const world = createWorld(course, log, { seed: 1 });
    world.race.phase = 'racing';
    const player = racerOf(world, 'player');
    placeOnTile(player, CANNON_TILE.col - 1, CANNON_TILE.row);
    player.body.y = (CANNON_TILE.row + 1) * TILE - player.body.h;
    for (let ticks = 0; ticks < 30 && centreOf(player).x < CANNON_TILE.col * TILE; ticks++) {
      step(world, log, 1, hold({ x: 1, y: 0 }));
    }
    step(world, log, HOLD_TICKS + CANNON_TILE.flightTicks - 1);
    expect(eventsIn(log, 'cannon.fired')).toContainEqual({ type: 'cannon.fired', racer: 'player', cannon: 0 });

    step(world, log, 1, hold({ x: 0, y: -1 }));

    expect(eventsIn(log, 'racer.jumped')).not.toContainEqual({ type: 'racer.jumped', id: 'player' });
  });

  it('respawns clear of a barrel that was the last tile over safe ground', () => {
    const sky = SKY.replace(/#{20}(?=\s*$)/, '########..........##');
    const { player, log, advance } = race([{ col: 5, row: 2, dir: [1, 1], speed: 1200, flightTicks: 60 }], sky);
    placeOnTile(player, 5, 2);
    advance(HOLD_TICKS + 8);
    expect(eventsIn(log, 'racer.fell')).toContainEqual({ type: 'racer.fell', id: 'player' });
    advance(60);
    expect(eventsIn(log, 'racer.respawned')).toContainEqual(expect.objectContaining({ id: 'player' }));
    expect(eventsIn(log, 'cannon.loaded')).toHaveLength(1);
    expect(centreOf(player).x).toBeLessThan(5 * TILE);
  });
});

describe('flight rival routes through cloud cannons', () => {
  const approach = { ...CANNON_TILE, col: 6, dir: [1, 0], speed: 480, flightTicks: 20 } satisfies CannonDef;

  it('prices the first shot only up to the second cannon in a chain', () => {
    const second = { ...approach, col: 9, dir: [0, -1], flightTicks: 4 } satisfies CannonDef;
    const { world } = race([approach, second]);

    // Five flight ticks to the second barrel plus the hold, at 0.125 tile per tick of cruise.
    expect(flightDistanceAt(world, { x: 6, y: 5 })).toBeCloseTo(flightDistanceAt(world, { x: 9, y: 5 }) + 2.875);
  });

  it.each([
    { flightTicks: 30, distance: 7.375, landing: 'beyond' },
    { flightTicks: 6, distance: 12, landing: 'inside' },
  ])(
    'finds the only route when the second shot ends $landing the reloading first barrel',
    ({ flightTicks, distance }) => {
      const sky = `
      ##############
      ######1#######
      ######2#######
      ######3#######
      ######4#######
      #...........F#
      ##############
    `;
      const first = { ...approach, dir: [-1, 0] } satisfies CannonDef;
      const second = { ...approach, col: 3, flightTicks };
      const { world, player, log, advance } = race([first, second], sky, {}, false);
      placeOnTile(player, first.col, first.row);
      for (let tick = 0; tick < 120 && !player.finished; tick++) advance(1, hold({ x: 1, y: 0 }));

      expect(flightDistanceAt(world, { x: 6, y: 5 })).toBeCloseTo(distance);
      expect(eventsIn(log, 'cannon.loaded').filter((event) => 'racer' in event && event.racer === 'player')).toEqual([
        { type: 'cannon.loaded', racer: 'player', cannon: 0 },
        { type: 'cannon.loaded', racer: 'player', cannon: 1 },
      ]);
      expect(player.finished).not.toBeNull();
    },
  );

  it('prices the launch by time and flies a rival into the faster route', () => {
    const fast = race([approach], SKY, {}, false);
    const plain = race([], SKY, {}, false);
    const mouth = { x: 6, y: 5 };
    const exit = { x: 16, y: 5 };
    expect(flightDistanceAt(fast.world, mouth)).toBeCloseTo(flightDistanceAt(fast.world, exit) + 4.75);
    const times = [fast, plain].map(({ world, advance }) => {
      const rival = racerOf(world, 'tess');
      placeOnTile(rival, 3, 5);
      for (let tick = 0; tick < 350 && !rival.finished; tick++) advance();
      expect(rival.finished).not.toBeNull();
      return rival.finished?.tick ?? Infinity;
    });
    expect(eventsIn(fast.log, 'cannon.loaded')).toContainEqual({ type: 'cannon.loaded', racer: 'tess', cannon: 0 });
    expect(times[0]).toBeLessThan(times[1] ?? 0);
  });

  it('prices the actual collision-shortened flight and flies around a backward shot', () => {
    const sky = SKY.replace('#.1...............F#', '#.1#..............F#');
    const { world, log, advance } = race([{ ...approach, dir: [-1, 0] }], sky, {}, false);
    const rival = racerOf(world, 'tess');
    placeOnTile(rival, 2, 4);
    const mouth = { x: 6, y: 5 };
    const exit = { x: 4, y: 5 };
    expect(flightDistanceAt(world, mouth)).toBeCloseTo(flightDistanceAt(world, exit) + 2.875);
    for (let tick = 0; tick < 350 && !rival.finished; tick++) advance();
    expect(rival.finished).not.toBeNull();
    expect(eventsIn(log, 'cannon.loaded')).not.toContainEqual({ type: 'cannon.loaded', racer: 'tess', cannon: 0 });
  });

  it('takes the straight path when a diagonal into a cannon costs more overall', () => {
    const marginal = { ...approach, row: 4, speed: 660, flightTicks: 4 };
    const { world, log, advance } = race([marginal], SKY, {}, false);
    const rival = racerOf(world, 'tess');
    placeOnTile(rival, 5, 5);
    // Already cruising with carry from a dash, as when comparing routes at a junction in a race.
    rival.body.vx = 180;
    expect(flightNextTile(world, { x: 5, y: 5 })).toEqual({ x: 1, y: 0 });
    for (let tick = 0; tick < 350 && !rival.finished; tick++) advance();
    expect(rival.finished).not.toBeNull();
    expect(eventsIn(log, 'cannon.loaded')).not.toContainEqual({ type: 'cannon.loaded', racer: 'tess', cannon: 0 });
  });
});
