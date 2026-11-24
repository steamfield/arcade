/**
 * Swim's way to the finish answers from the steer field, which is what the Easy guide, squids, decoys
 * and the Undertow get when they ask the medium: on Sunlit Shallows, along the whole route,
 * `nextTile`, `distanceAt` and `aimFrom` give the steer field's readings, never the smash or ram
 * field's.
 */
import { EventLog } from '@arcade/core';
import { describe, expect, it } from 'vitest';
import { downhillPath, openTiles, steerDirection } from '../../ai/steer.ts';
import { DEFAULT_COURSE } from '../../courses/index.ts';
import type { GameEvent } from '../../events.ts';
import { fieldAt } from '../../race/flowfield.ts';
import { RACER_SIZE, TILE, type Vec } from '../../types.ts';
import { createWorld } from '../../world.ts';
import { MEDIA } from '../index.ts';
import { swimNav } from './data.ts';
import { swimStepPrice } from './nav.ts';

const world = createWorld(DEFAULT_COURSE, new EventLog<GameEvent>(), { seed: 1 });
const swim = MEDIA.swim;
const { level } = world;
const nav = swimNav(world.nav);
const price = swimStepPrice(world, 'steer');
const start = level.starts[0] ?? { x: 0, y: 0 };
/** Every tile of the steer route from the first start, then every tenth one for the slower checks. */
const route = [start, ...downhillPath(nav.steer, nav, openTiles(level, world.broken, false), start, 2000, price)];
const sample = route.filter((_, index) => index % 10 === 0);

const boxOn = (tile: Vec) => ({
  x: tile.x * TILE + (TILE - RACER_SIZE.width) / 2,
  y: tile.y * TILE + (TILE - RACER_SIZE.height) / 2,
  w: RACER_SIZE.width,
  h: RACER_SIZE.height,
});

describe('the swim way on Sunlit Shallows', () => {
  it('follows a route that reaches the finish', () => {
    expect(route.at(-1)?.x).toBe(level.finishX);
  });

  it('gives each next tile of the steer route', () => {
    const steps = route.slice(0, -1).map((tile) => swim.nextTile(world, tile));
    const want = route
      .slice(1)
      .map((next, index) => ({ x: next.x - (route[index]?.x ?? 0), y: next.y - (route[index]?.y ?? 0) }));

    expect(steps).toEqual(want);
    expect(swim.nextTile(world, route.at(-1) ?? start)).toBeNull();
  });

  it('gives the steer field as the distance, falling all the way to 0 at the finish', () => {
    const distances = route.map((tile) => swim.distanceAt(world, tile));

    expect(distances).toEqual(route.map((tile) => fieldAt(nav.steer, nav, tile)));
    expect(distances.at(-1)).toBe(0);
    expect(swim.distanceAt(world, { x: -1, y: 0 })).toBe(Number.POSITIVE_INFINITY);
  });

  it('aims a body along the steer field', () => {
    const aims = sample.map((tile) => swim.aimFrom(world, boxOn(tile), 3));

    expect(aims).toEqual(
      sample.map((tile) => steerDirection(nav.steer, nav, level, world.broken, boxOn(tile), 3, false, price)),
    );
  });
});
