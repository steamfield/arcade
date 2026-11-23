import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { PLAYER_PROFILE } from '../ai/profiles.ts';
import type { GameEvent } from '../events.ts';
import { parseLevel } from '../level/parse.ts';
import { tileIndex } from '../level/query.ts';
import { noItems } from '../racers.ts';
import { type Body, type Level, RACER_SIZE, type Racer, type RacerId, TILE } from '../types.ts';
import { moveBody, separateRacers } from './collide.ts';
import { SWIM } from './physics.ts';

/** A room with one solid tile at column 4, row 2 (pixels 64..80 by 32..48). */
const room = (pillar: '#' | 'C' = '#'): Level =>
  parseLevel({
    name: 'room',
    ascii: `
      ##########
      #........F
      #...${pillar}....F
      #........F
      #1234....F
      ##########
    `,
  });

const body = (x: number, y: number, vx = 0, vy = 0): Body => ({
  x,
  y,
  vx,
  vy,
  w: RACER_SIZE.width,
  h: RACER_SIZE.height,
});

function move(target: Body, level: Level, ticks: number, broken: ReadonlySet<number> = new Set()) {
  for (let i = 0; i < ticks; i++) moveBody(target, level, broken, TICK_DT);
}

/** True when the body covers any positive area of a solid tile (rock, unbroken coral or outside the map). */
function insideSolid(target: Body, level: Level): boolean {
  for (let ty = Math.floor(target.y / TILE); ty < Math.ceil((target.y + target.h) / TILE); ty++) {
    for (let tx = Math.floor(target.x / TILE); tx < Math.ceil((target.x + target.w) / TILE); tx++) {
      const cell = level.cells[ty]?.[tx];
      if (cell === undefined || cell === 'rock' || cell === 'coral') return true;
    }
  }
  return false;
}

describe('moving through tiles', () => {
  it.each([
    { side: 'left side', start: body(40, 35, 60, 0), stop: { x: 52, y: 35 } },
    { side: 'right side', start: body(90, 35, -60, 0), stop: { x: 80, y: 35 } },
    { side: 'underside', start: body(66, 55, 0, -60), stop: { x: 66, y: 48 } },
    { side: 'top', start: body(66, 20, 0, 60), stop: { x: 66, y: 22 } },
  ])('stops flush against the $side of a rock and loses that velocity', ({ start, stop }) => {
    move(start, room(), 30);

    expect(start.x).toBeCloseTo(stop.x, 6);
    expect(start.y).toBeCloseTo(stop.y, 6);
    expect(start.vx).toBe(0);
    expect(start.vy).toBe(0);
  });

  it('slides along a floor when moving diagonally into it', () => {
    const slider = body(80, 65, 60, 60);
    move(slider, room(), 30);

    expect(slider.y + slider.h).toBeCloseTo(5 * TILE, 6);
    expect(slider.vy).toBe(0);
    expect(slider.x).toBeCloseTo(110, 6);
    expect(slider.vx).toBe(60);
  });

  it('never ends a tick inside a solid tile swimming at top speed in any direction', () => {
    const level = room();
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const norm = Math.hypot(dx, dy);
      const swimmer = body(98, 35, (dx / norm) * SWIM.maxSpeed, (dy / norm) * SWIM.maxSpeed);
      for (let tick = 0; tick < 120; tick++) {
        move(swimmer, level, 1);
        expect(insideSolid(swimmer, level), `heading ${dx},${dy} at tick ${tick}`).toBe(false);
      }
    }
  });

  it('does not tunnel through a one-tile wall when moving more than a tile in one tick', () => {
    const bullet = body(40, 35, 4000, 0);
    move(bullet, room(), 1);

    expect(bullet.x).toBeCloseTo(52, 6);
    expect(bullet.vx).toBe(0);
  });

  it('passes through coral once it is broken and stops at it before', () => {
    const level = room('C');
    const blocked = body(40, 35, 60, 0);
    move(blocked, level, 60);
    expect(blocked.x).toBeCloseTo(52, 6);

    const through = body(40, 35, 60, 0);
    move(through, level, 60, new Set([tileIndex(level, 4, 2)]));
    expect(through.x).toBeCloseTo(100, 6);
    expect(through.vx).toBe(60);
  });
});

function racer(id: RacerId, x: number, mass = 1): Racer {
  return {
    id,
    character: 'rudy',
    motion: {},
    body: body(x, 50),
    facing: 1,
    kickCooldown: 0,
    progress: Number.POSITIVE_INFINITY,
    place: 1,
    finished: null,
    ai: null,
    profile: { ...PLAYER_PROFILE, id, mass },
    ...noItems(),
  };
}

describe('racer separation', () => {
  it('pushes overlapping racers apart along the shallower overlap, the lighter one further', () => {
    const light = racer('player', 100, 1);
    const heavy = racer('bo', 106, 2);
    separateRacers([light, heavy], new Set(), new EventLog<GameEvent>());

    expect(light.body.x).toBeCloseTo(96, 6);
    expect(heavy.body.x).toBeCloseTo(108, 6);
    expect(light.body.y).toBe(50);
    expect(heavy.body.y).toBe(50);
  });

  it('exchanges half the closing speed between equal racers on the push axis', () => {
    const chaser = racer('player', 100);
    const leader = racer('tess', 106);
    chaser.body.vx = 40;
    separateRacers([chaser, leader], new Set(), new EventLog<GameEvent>());

    expect(chaser.body.vx).toBeCloseTo(20, 6);
    expect(leader.body.vx).toBeCloseTo(20, 6);
    expect(chaser.body.vy).toBe(0);
    expect(leader.body.vy).toBe(0);
  });

  it('announces a bump once when contact starts, not on every tick it lasts', () => {
    const a = racer('player', 100);
    const b = racer('tess', 106);
    const contacts = new Set<string>();
    const log = new EventLog<GameEvent>();
    const touch = () => {
      a.body.x = 100;
      b.body.x = 106;
      separateRacers([a, b], contacts, log);
    };

    touch();
    touch();
    touch();
    expect(log.all()).toMatchObject([{ type: 'racer.bumped', a: 'player', b: 'tess' }]);
    expect([...contacts]).toEqual(['player|tess']);

    b.body.x = 200;
    separateRacers([a, b], contacts, log);
    expect(contacts.size).toBe(0);

    touch();
    expect(log.all()).toHaveLength(2);
  });

  it('hands a new contact to onBump with the speeds the pair bumped with, then shares their closing speed', () => {
    const a = racer('player', 100);
    const b = racer('tess', 106);
    a.body.vx = 60;
    b.body.vx = 20;
    const seen: [number, number][] = [];

    separateRacers([a, b], new Set(), new EventLog<GameEvent>(), undefined, (first, second) => {
      seen.push([first.body.vx, second.body.vx]);
      // What onBump does to the velocities stays: the shared closing speed is added on top.
      first.body.vx -= 10;
    });

    expect(seen).toEqual([[60, 20]]);
    expect([a.body.vx, b.body.vx]).toEqual([30, 40]);
  });

  it('leaves racers a pixel apart untouched and silent', () => {
    const a = racer('player', 100);
    const b = racer('tess', 113);
    const contacts = new Set<string>();
    const log = new EventLog<GameEvent>();
    separateRacers([a, b], contacts, log);

    expect([a.body.x, b.body.x]).toEqual([100, 113]);
    expect(log.all()).toEqual([]);
    expect(contacts.size).toBe(0);
  });
});

describe('recovering from a push into a wall', () => {
  /** A racer that a bump has shoved 3.5 px into the left wall (column 0). */
  function shovedIntoWall(): Racer {
    const shoved = racer('player', 17);
    const shover = racer('tess', 20);
    separateRacers([shoved, shover], new Set(), new EventLog<GameEvent>());
    expect(insideSolid(shoved.body, room())).toBe(true);
    return shoved;
  }

  it('keeps sinking along the wall instead of sticking to it', () => {
    const { body: shoved } = shovedIntoWall();
    shoved.vy = 30;
    move(shoved, room(), 30);

    expect(shoved.vy).toBe(30);
    expect(shoved.y).toBeCloseTo(65, 6);
    expect(insideSolid(shoved, room())).toBe(false);
  });

  it('swims diagonally away from the wall at full velocity', () => {
    const { body: shoved } = shovedIntoWall();
    shoved.vx = 60;
    shoved.vy = -30;
    move(shoved, room(), 20);

    expect([shoved.vx, shoved.vy]).toEqual([60, -30]);
    expect(shoved.y).toBeCloseTo(40, 6);
    expect(insideSolid(shoved, room())).toBe(false);
  });
});

describe('a very long tick', () => {
  it.each([1e9, Number.POSITIVE_INFINITY])('returns with the body outside solids for dt %s', (dt) => {
    const level = room();
    const flier = body(40, 35, 60, 0);
    moveBody(flier, level, new Set(), dt);

    expect(flier.x).toBeCloseTo(52, 6);
    expect(flier.vx).toBe(0);
    expect(insideSolid(flier, level)).toBe(false);
  });
});
