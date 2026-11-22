import { describe, expect, it } from 'vitest';
import { placeAt, raceOn, racerOf } from '../../logic/test-world.ts';
import type { Squid, SquidTarget } from '../../logic/types.ts';
import { MARKER_BOUNDS, markerFor, squidHuntingPlayer, TOUCH_ZONES } from './threat-math.ts';

const ARENA = `
  ####################
  #1................F#
  #2................F#
  #3................F#
  #4................F#
  ####################
`;

const squidAt = (x: number, y: number, target: SquidTarget | null): Squid => ({
  x,
  y,
  vx: 0,
  vy: 0,
  ttl: 100,
  owner: 'tess',
  target,
});

describe('which squid is hunting the player', () => {
  it('is none when no squid is in the water', () => {
    const { world } = raceOn(ARENA);
    expect(squidHuntingPlayer(world)).toBeNull();
  });

  it('ignores squids chasing a rival, a decoy, or nothing', () => {
    const { world } = raceOn(ARENA);
    world.squids.push(
      squidAt(50, 50, { kind: 'racer', id: 'squib' }),
      squidAt(60, 60, { kind: 'decoy', owner: 'player' }),
      squidAt(70, 70, null),
    );
    expect(squidHuntingPlayer(world)).toBeNull();
  });

  it('picks the nearest of the squids locked on the player', () => {
    const { world } = raceOn(ARENA);
    placeAt(racerOf(world, 'player'), { x: 100, y: 40 });
    const far = squidAt(250, 40, { kind: 'racer', id: 'player' });
    const near = squidAt(130, 40, { kind: 'racer', id: 'player' });
    world.squids.push(far, near);
    expect(squidHuntingPlayer(world)).toBe(near);
  });
});

describe('the lock-on arrow', () => {
  const player = { x: 160, y: 100 };
  const insideBounds = (point: { x: number; y: number }) =>
    point.x >= MARKER_BOUNDS.x &&
    point.x <= MARKER_BOUNDS.x + MARKER_BOUNDS.w &&
    point.y >= MARKER_BOUNDS.y &&
    point.y <= MARKER_BOUNDS.y + MARKER_BOUNDS.h;
  const inZone = (point: { x: number; y: number }) =>
    TOUCH_ZONES.some(
      (zone) => point.x >= zone.x && point.x <= zone.x + zone.w && point.y >= zone.y && point.y <= zone.y + zone.h,
    );

  it('sits on the right edge pointing right for a squid far off to the right', () => {
    const marker = markerFor(player, { x: 700, y: 100 });
    expect(marker).toEqual({ x: MARKER_BOUNDS.x + MARKER_BOUNDS.w, y: 100, angle: 0 });
  });

  it('sits just short of a squid that is in view, pointing at it', () => {
    const marker = markerFor(player, { x: 200, y: 100 });
    expect(marker).toEqual({ x: 186, y: 100, angle: 0 });
  });

  it('points down for a squid below and diagonally for one between', () => {
    expect(markerFor(player, { x: 160, y: 900 }).angle).toBeCloseTo(Math.PI / 2);
    expect(markerFor(player, { x: 560, y: 500 }).angle).toBeCloseTo(Math.PI / 4);
    expect(markerFor(player, { x: -400, y: -200 }).angle).toBeCloseTo(-Math.PI * (3 / 4));
  });

  it('never lands under the d-pad, the A/B buttons or the back link, whichever way the squid is', () => {
    for (let x = -800; x <= 1100; x += 60) {
      for (let y = -600; y <= 800; y += 60) {
        const marker = markerFor(player, { x, y });
        expect(insideBounds(marker), `squid at ${x},${y}`).toBe(true);
        expect(inZone(marker), `squid at ${x},${y} gave ${marker.x},${marker.y}`).toBe(false);
      }
    }
  });
});
