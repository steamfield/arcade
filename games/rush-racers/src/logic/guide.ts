/**
 * The Easy way-finding guide. A young player who holds toward the finish and steers only after
 * hitting something can sit against a wall for many seconds when the way on is up or down. Two
 * helps, both asked of the world's medium (the way its rivals follow) and both off unless the level's
 * `guide` knob is on:
 * - `guideFor` says which way is on from the player's tile and for how long they have pushed without
 *   getting any closer; the engine shows an arrow from it.
 * - `assistedIntent` slides a player who is pushing into a wall along it toward the way on, by
 *   blending the guide direction into the stick. It never adds speed (swimming normalises the stick),
 *   never works against a stick held the other way, never touches rivals or Normal and Hard, and
 *   leaves `move.y` alone in a medium whose `effects.assistAxes` is 'horizontal'.
 * Deterministic: no rng, every number comes from the world.
 */

import { tileOf } from './ai/steer.ts';
import { tuningOf } from './difficulty-level.ts';
import { mediumOf } from './media/index.ts';
import { length } from './num.ts';
import { centreOf, playerOf } from './racers.ts';
import type { Intent, Racer, Vec, World } from './types.ts';

/** Tiles along the medium's way the aim looks ahead, as the rivals do. */
const LOOKAHEAD_TILES = 3;
/** A stick pushed less than this far is not "pushing". */
const PUSH_THRESHOLD = 0.3;
/** A stick whose cosine with the way on is below this (more than 120 degrees away) is held the other way and gets no help. */
const OPPOSED = -0.5;
/** At or below this speed (px/s) a pushing racer is against something, not swimming. */
const WALL_SPEED = 30;

/** Where the way on is and how long the racer has gone without progress. */
export interface Guide {
  /** The tile offset (each of x and y in -1, 0, 1) of the neighbour nearer the finish (`Medium.nextTile`); null on the finish tile or when boxed in. */
  dir: Vec | null;
  /**
   * The unit vector toward the finish along the medium's way from the body (`Medium.aimFrom`, a few
   * tiles ahead), which the assist slides toward; zero on the finish tile.
   */
  aim: Vec;
  /** Ticks the player has pushed without reaching a tile closer to the finish; 0 for a rival. */
  stuckTicks: number;
}

/** The guide for `racer`: the way on from its tile, and the stuck time (the player's only). */
export function guideFor(world: World, racer: Racer): Guide {
  const medium = mediumOf(world);
  return {
    dir: medium.nextTile(world, tileOf(centreOf(racer))),
    aim: medium.aimFrom(world, racer.body, LOOKAHEAD_TILES),
    stuckTicks: racer.id === 'player' ? world.guide.stuckTicks : 0,
  };
}

/**
 * How far the player at `tile` is from the finish, as the guide measures getting closer: the
 * medium's distance (`Medium.distanceAt`; lower is closer, Infinity where the finish can't be
 * reached). The engine's debug stage reads it too.
 */
export function guideDistanceAt(world: World, tile: Vec): number {
  return mediumOf(world).distanceAt(world, tile);
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
 * Where the medium's `effects.assistAxes` is 'horizontal' only `move.x` slides, so the assist never
 * presses or lets go of Up or Down for the player.
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
  const horizontalOnly = mediumOf(world).effects.assistAxes === 'horizontal';
  return {
    ...intent,
    move: {
      x: clampStick(intent.move.x + sideways.x * tuning.assistBlend),
      y: horizontalOnly ? intent.move.y : clampStick(intent.move.y + sideways.y * tuning.assistBlend),
    },
  };
}

function clampStick(value: number): number {
  return Math.max(-1, Math.min(1, value));
}
