/**
 * The Easy way-finding guide. A young player who holds toward the finish and steers only after
 * hitting something can sit against a wall for many seconds when the way on is up or down. Two
 * helps, both read from the steer flow field the rivals follow and both off unless the level's
 * `guide` knob is on:
 * - `guideFor` says which way is on from the player's tile and for how long they have pushed without
 *   getting any closer; the engine shows an arrow from it.
 * - `assistedIntent` slides a player who is pushing into a wall along it toward the way on, by
 *   blending the guide direction into the stick. It never adds speed (swimming normalises the stick),
 *   never works against a stick held the other way, and never touches rivals or Normal and Hard.
 * Deterministic: no rng, every number comes from the world.
 */

import { downhillPath, openTiles, steerDirection, tileOf } from './ai/steer.ts';
import { tuningOf } from './difficulty-level.ts';
import { length } from './num.ts';
import { fieldAt } from './race/flowfield.ts';
import { centreOf, playerOf } from './racers.ts';
import type { Intent, Racer, Vec, World } from './types.ts';

/** Tiles down the field the aim looks ahead, as the rivals do. */
const LOOKAHEAD_TILES = 3;
/** A stick pushed less than this far is not "pushing". */
const PUSH_THRESHOLD = 0.3;
/** A stick whose cosine with the way on is below this (more than 120 degrees away) is held the other way and gets no help. */
const OPPOSED = -0.5;
/** At or below this speed (px/s) a pushing racer is against something, not swimming. */
const WALL_SPEED = 30;

/** Where the way on is and how long the racer has gone without progress. */
export interface Guide {
  /** The tile offset (each of x and y in -1, 0, 1) of the neighbour that lowers the steer field most; null on the finish tile or when boxed in. */
  dir: Vec | null;
  /**
   * The unit vector the rivals' own steering aims along from the body (a few tiles down the field, never
   * cutting a corner the body would clip), which the assist slides toward; zero on the finish tile.
   */
  aim: Vec;
  /** Ticks the player has pushed without reaching a tile closer to the finish; 0 for a rival. */
  stuckTicks: number;
}

/** The guide for `racer`: the way on from its tile, and the stuck time (the player's only). */
export function guideFor(world: World, racer: Racer): Guide {
  const start = tileOf(centreOf(racer));
  const next = downhillPath(world.fields.steer, world.fields, openTiles(world.level, world.broken, false), start, 1)[0];
  return {
    dir: next ? { x: next.x - start.x, y: next.y - start.y } : null,
    aim: steerDirection(world.fields.steer, world.fields, world.level, world.broken, racer.body, LOOKAHEAD_TILES),
    stuckTicks: racer.id === 'player' ? world.guide.stuckTicks : 0,
  };
}

/**
 * How far the player at `tile` is from the finish, as the guide measures getting closer (lower is
 * closer; Infinity where the finish can't be reached). The engine's debug stage reads it too.
 */
export function guideDistanceAt(world: World, tile: Vec): number {
  return fieldAt(world.fields.steer, world.fields, tile);
}

/**
 * Updates the player's guide memory from this tick's raw input. The stuck time resets whenever the
 * player's tile is closer to the finish than any before, grows while the stick is held without
 * that, and holds while the stick is let go or the player can't act (stunned or trapped). The
 * assist switches on once the player has pushed past the grace while nearly at rest (against a
 * wall), then stays on for `assistHoldTicks` of pushing, so the slide carries along the whole wall
 * instead of stopping at the first tile gained. Does nothing when the level has no guide.
 */
export function trackGuide(world: World, input: Intent): void {
  const tuning = tuningOf(world).guide;
  if (!tuning.enabled) return;
  const player = playerOf(world);
  if (player.finished || player.status.stunned > 0 || player.status.trapped > 0) return;
  const here = guideDistanceAt(world, tileOf(centreOf(player)));
  const memory = world.guide;
  const pushing = length(input.move.x, input.move.y) >= PUSH_THRESHOLD;
  if (here < memory.bestSteer) {
    memory.bestSteer = here;
    memory.stuckTicks = 0;
  } else if (pushing) {
    memory.stuckTicks++;
  }
  const atRest = length(player.body.vx, player.body.vy) <= WALL_SPEED;
  if (pushing && atRest && memory.stuckTicks > tuning.assistGraceTicks) memory.helpTicks = tuning.assistHoldTicks;
  else if (pushing && memory.helpTicks > 0) memory.helpTicks--;
}

/**
 * The intent the player's racer acts on: `intent`, plus on a guided level a slide toward the way on
 * while the assist is on. The slide is the part of the guide direction that is sideways to the
 * stick, scaled by `assistBlend`; a stick held away from the way on (against it) gets nothing.
 */
export function assistedIntent(world: World, racer: Racer, intent: Intent): Intent {
  const tuning = tuningOf(world).guide;
  if (!tuning.enabled || racer.id !== 'player' || racer.ai || world.guide.helpTicks === 0) return intent;
  const push = length(intent.move.x, intent.move.y);
  if (push < PUSH_THRESHOLD) return intent;
  const way = guideFor(world, racer).aim;
  const stick = { x: intent.move.x / push, y: intent.move.y / push };
  const along = way.x * stick.x + way.y * stick.y;
  if (along < OPPOSED) return intent;
  const sideways = { x: way.x - stick.x * along, y: way.y - stick.y * along };
  return {
    ...intent,
    move: {
      x: clampStick(intent.move.x + sideways.x * tuning.assistBlend),
      y: clampStick(intent.move.y + sideways.y * tuning.assistBlend),
    },
  };
}

function clampStick(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
