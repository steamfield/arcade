/**
 * Cloudreach's Headwind: a gust front that sweeps forward from its owner along the course, holding
 * back every racer it passes over.
 *
 * Fired, a front `HEADWIND_TUNING.widthTiles` wide starts with its back edge at the owner's centre and
 * sweeps toward +x at `speed` for `sweepTiles`, spanning the sky's whole height, then ends. It is not a
 * hit: while a racer is inside it, its medium feels a strong headwind (`headwindAt`, which flight reads
 * in `media/flight/env.ts`). A cruising flyer is a little slower than the front, so the front catches
 * it, holds it back for about a second and passes on.
 *
 * A Headwind twist's fields: `x` is the front's centre, px, moving at `vx` px/s; `y` is the owner's
 * centre height when fired, which only the events report, since the front has no height; `vy` is 0;
 * `ttl` counts the ticks left of its sweep; `phase` is unused and stays 0.
 */
import { TICK_DT } from '@arcade/core';
import { mayAttack } from '../../difficulty-level.ts';
import { activeRacers, centreOf } from '../../racers.ts';
import { isInvulnerable } from '../../status.ts';
import { type Racer, TILE, type Twist, type World } from '../../types.ts';
import { CLAM } from '../tuning.ts';
import type { TwistRules } from './index.ts';

/** The Headwind's numbers. */
export const HEADWIND_TUNING = {
  /** The front's width, tiles. */
  widthTiles: 6,
  /**
   * How fast the front sweeps toward +x, px/s: a little faster than a flyer's 120 px/s cruise, so it
   * catches a flyer and stays over it for about a second, costing one holding right about 3 tiles.
   */
  speed: 180,
  /** How far the front sweeps before it dies away, tiles. */
  sweepTiles: 30,
  /** The wind a racer inside the front feels along x: twice a `<` cell's. */
  gust: -2,
  /**
   * A rival fires it from 3rd or 4th with a racer it may attack this many tiles ahead, as it fires the
   * shared Undertow (`ai/items.ts` ITEM_USE.undertowLeadTiles, not imported because `ai/items.ts`
   * imports this module).
   */
  rivalLeadTiles: 8,
  /**
   * The farthest ahead a rival aims it: the front gains about 60 px/s on a cruising flyer for its
   * sweep, so it never reaches one starting much more than 16 tiles ahead.
   */
  rivalReachTiles: 16,
} as const;

/** Half the front's width, px. */
const HALF_WIDTH_PX = (HEADWIND_TUNING.widthTiles * TILE) / 2;

/** Ticks the front takes to sweep its `sweepTiles`. */
export const HEADWIND_SWEEP_TICKS = Math.round((HEADWIND_TUNING.sweepTiles * TILE) / (HEADWIND_TUNING.speed * TICK_DT));

/** How the Headwind is fired, sweeps and is chosen by rivals. */
export const HEADWIND: TwistRules = {
  fire: fireHeadwind,
  advance: advanceHeadwind,
  rivalWants: rivalWantsHeadwind,
};

/**
 * The wind along x a Headwind front gives `racer` right now: `HEADWIND_TUNING.gust` while its centre
 * is inside a front that another racer fired and that racer may attack it (`mayAttack`, so an Easy
 * rival's front passes a human by), else null. A racer that has finished, has fallen out of play or
 * is invulnerable feels nothing, as lightning skips them. A medium reads it while sampling the
 * racer's surroundings.
 */
export function headwindAt(world: World, racer: Racer): number | null {
  if (racer.finished || racer.status.fallen > 0 || isInvulnerable(racer)) return null;
  const { x } = centreOf(racer);
  const caught = world.twists.some(
    (twist) =>
      twist.style === 'headwind' &&
      twist.owner !== racer.id &&
      mayAttack(world, twist.owner, racer.id) &&
      x >= twist.x - HALF_WIDTH_PX &&
      x < twist.x + HALF_WIDTH_PX,
  );
  return caught ? HEADWIND_TUNING.gust : null;
}

/** The front's left and right edges, px. */
export function headwindSpan(twist: Twist): { left: number; right: number } {
  return { left: twist.x - HALF_WIDTH_PX, right: twist.x + HALF_WIDTH_PX };
}

/** Starts a front with its back edge on the owner's centre, sweeping toward +x whatever the aim, and emits `twist.launched`. */
function fireHeadwind(world: World, racer: Racer): void {
  const centre = centreOf(racer);
  world.twists.push({
    style: 'headwind',
    owner: racer.id,
    x: centre.x + HALF_WIDTH_PX,
    y: centre.y,
    vx: HEADWIND_TUNING.speed,
    vy: 0,
    ttl: HEADWIND_SWEEP_TICKS,
    phase: 0,
  });
  world.events.emit({ type: 'twist.launched', owner: racer.id, style: 'headwind' });
}

/**
 * Moves the front one tick. It ends, emitting `twist.ended` at its centre, once it has swept its
 * whole distance or its back edge has passed the level's right edge. Returns false once it has ended.
 */
function advanceHeadwind(world: World, twist: Twist, _racing: readonly Racer[], dt: number): boolean {
  twist.x += twist.vx * dt;
  twist.ttl -= 1;
  const leftLevel = headwindSpan(twist).left >= world.level.width * TILE;
  if (twist.ttl > 0 && !leftLevel) return true;
  world.events.emit({ type: 'twist.ended', owner: twist.owner, style: 'headwind', x: twist.x, y: twist.y });
  return false;
}

/**
 * True when `racer` is in 3rd place or worse and some racer it may attack is at least
 * `rivalLeadTiles` ahead by progress (the shared Undertow's rule), but no more than
 * `rivalReachTiles`, which the front could never catch.
 */
function rivalWantsHeadwind(world: World, racer: Racer): boolean {
  if (racer.place < CLAM.undertowMinPlace) return false;
  return activeRacers(world).some(
    (other) =>
      other.id !== racer.id &&
      mayAttack(world, racer.id, other.id) &&
      other.progress <= racer.progress - HEADWIND_TUNING.rivalLeadTiles &&
      other.progress >= racer.progress - HEADWIND_TUNING.rivalReachTiles,
  );
}
