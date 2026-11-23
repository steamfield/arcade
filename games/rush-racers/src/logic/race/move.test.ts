/**
 * Moving a body through the tiles: stopping flush at solids, sliding, no tunnelling, broken coral,
 * recovering from a push into a wall, and very long ticks.
 */
import { EventLog, TICK_DT } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { PLAYER_PROFILE } from '../ai/profiles.ts';
import type { GameEvent } from '../events.ts';
import { parseLevel } from '../level/parse.ts';
import { tileIndex } from '../level/query.ts';
import { SWIM_TUNING as SWIM } from '../media/swim/tuning.ts';
import { noItems } from '../racers.ts';
import { type Body, type Level, RACER_SIZE, type Racer, type RacerId, TILE } from '../types.ts';
import { moveBody, NO_MOVE_RULES } from './move.ts';
import { separateRacers } from './separate.ts';

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
  for (let i = 0; i < ticks; i++) moveBody(target, level, broken, TICK_DT, NO_MOVE_RULES);
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
    motion: { kind: 'swim' },
    body: body(x, 50),
    facing: 1,
    kickCooldown: 0,
    kickCharges: 2,
    kickRecharge: 0,
    progress: Number.POSITIVE_INFINITY,
    place: 1,
    finished: null,
    ai: null,
    profile: { ...PLAYER_PROFILE, id, mass },
    ...noItems(3),
  };
}

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
    moveBody(flier, level, new Set(), dt, NO_MOVE_RULES);

    expect(flier.x).toBeCloseTo(52, 6);
    expect(flier.vx).toBe(0);
    expect(insideSolid(flier, level)).toBe(false);
  });
});
