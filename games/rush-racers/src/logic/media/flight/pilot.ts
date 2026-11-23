/**
 * Flight's rival pilot: fly toward a point a few tiles along the way, flapping with real presses
 * (Up let go between flaps, pressed only once the flap is ready) while below it, gliding while level
 * with it, diving when far above it, and dashing on aligned straights as `kickSkill` allows. It
 * reads the way again every `reactionTicks` (at once when knocked far from its target), puts the profile's `wobble` on that point as an altitude
 * and aim jitter (never on the stick, so it never flaps by accident), and on `forceRecover` backs off
 * and flaps up for a beat. Its memory is a `FlightPilot` (`way-data.ts`).
 *
 * Scaffold baseline: phase 1 lane b replaces it behind the same exports.
 */

import { length } from '../../num.ts';
import { centreOf } from '../../racers.ts';
import { type MoveModifiers, type Racer, TILE, type Vec, type World } from '../../types.ts';
import { effectiveTuning } from '../index.ts';
import type { AiDraws, Steering } from '../types.ts';
import { flightMotion } from './data.ts';
import { flightExtra } from './physics.ts';
import { flightNextTile } from './way.ts';
import { type FlightPilot, flightPilot } from './way-data.ts';

/** Most tiles along the way the pilot flies toward (it stops at a turn). */
const LOOKAHEAD_TILES = 3;
/** Tiles from its target past which it replans at once (it was knocked or put somewhere else). */
const LOST_TILES = 6;
/** Ticks of a stuck recovery: backing off and flapping up. */
const RECOVER_TICKS = 40;
/** Px the target may sit above the flyer's centre before it flaps. */
const CLIMB_MARGIN = 4;
/** It flaps again only once a flap's rise has slowed to this, as a share of the flap's lift. */
const FLAP_AGAIN_RISE = 0.4;
/** Target this far below, in tiles, and it dives. */
const DIVE_BELOW_TILES = 2;
/** Largest jitter, in tiles, a wobble of 1 puts on the target's height and reach. */
const WOBBLE_TILES = 1.5;
/** Px/s of horizontal speed wanted per px of distance to the target, so it slows as it lines up. */
const APPROACH_GAIN = 6;
/** Px/s either side of the wanted horizontal speed where it lets go of the stick. */
const SPEED_SLACK = 10;
/** Its aim must be this close to level for a dash. */
const DASH_ALIGN = 0.9;

/** A flight rival's pilot memory at the start line. */
export function createFlightPilot(): FlightPilot {
  return {
    kind: 'flight',
    upHeld: false,
    target: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    replanIn: 0,
    recoverTicks: 0,
    recoverDir: -1,
  };
}

/**
 * A flight rival's steering this tick. Mutates only its pilot memory.
 *
 * @throws {Error} When `racer.ai` is null (a human drives it), or its memory, motion or the world's nav isn't flight's.
 */
export function steerFlyer(
  world: World,
  racer: Racer,
  _mods: MoveModifiers,
  draws: AiDraws,
  forceRecover: boolean,
): Steering {
  const ai = racer.ai;
  if (!ai) throw new Error(`flight.steer needs AI memory, but racer '${racer.id}' has none (a human drives it)`);
  const memory = flightPilot(ai.pilot);
  const centre = centreOf(racer);
  const lost = length(memory.target.x - centre.x, memory.target.y - centre.y) > LOST_TILES * TILE;
  if (memory.replanIn <= 0 || lost) replan(world, racer, memory, centre, draws.wobble);
  else memory.replanIn--;
  memory.aim = unitToward(centre, memory.target);

  if (forceRecover && memory.recoverTicks === 0) {
    memory.recoverTicks = RECOVER_TICKS;
    memory.recoverDir = memory.aim.x > 0 ? -1 : 1;
  }
  if (memory.recoverTicks > 0) {
    memory.recoverTicks--;
    const up = climbPress(world, racer, memory, -TILE);
    return {
      move: { x: memory.recoverDir, y: up ? -1 : 0 },
      kick: false,
      kickHeld: false,
      aim: memory.aim,
      recovering: true,
    };
  }

  const dx = memory.target.x - centre.x;
  const dy = memory.target.y - centre.y;
  const vertical = verticalStick(world, racer, memory, dy);
  const move = { x: horizontalStick(world, racer, dx), y: vertical };
  const kick =
    racer.kickCooldown === 0 &&
    Math.abs(memory.aim.x) > DASH_ALIGN &&
    Math.sign(memory.aim.x) === racer.facing &&
    draws.kick < racer.profile.kickSkill;
  return { move, kick, kickHeld: kick, aim: memory.aim, recovering: false };
}

/** Reads the way again: the point `LOOKAHEAD_TILES` along it, jittered by the profile's wobble. */
function replan(world: World, racer: Racer, memory: FlightPilot, centre: Vec, roll: number): void {
  const tile = { x: Math.floor(centre.x / TILE), y: Math.floor(centre.y / TILE) };
  const ahead = cornerAhead(world, tile, LOOKAHEAD_TILES);
  const jitter = (roll * 2 - 1) * racer.profile.wobble * WOBBLE_TILES * TILE;
  memory.target = { x: (ahead.x + 0.5) * TILE + jitter * 0.5, y: (ahead.y + 0.5) * TILE + jitter };
  memory.replanIn = Math.max(0, racer.profile.reactionTicks - 1);
}

/**
 * The tile up to `steps` along the way from `tile`, stopping at the first turn, so a flyer lines up
 * with a shaft or a gap before it heads in rather than cutting the corner into the wall.
 */
function cornerAhead(world: World, tile: Vec, steps: number): Vec {
  let at = tile;
  let heading: Vec | null = null;
  for (let i = 0; i < steps; i++) {
    const step = flightNextTile(world, at);
    if (!step || (heading && (step.x !== heading.x || step.y !== heading.y))) break;
    heading = step;
    at = { x: at.x + step.x, y: at.y + step.y };
  }
  return at;
}

/**
 * Up (-1), nothing (0) or Down (1): flap with a real press while the target is above, keep holding
 * Up after a flap to glide while level with it, dive when it is far below.
 */
function verticalStick(world: World, racer: Racer, memory: FlightPilot, dy: number): number {
  if (dy < -CLIMB_MARGIN) return climbPress(world, racer, memory, dy) ? -1 : 0;
  if (dy > DIVE_BELOW_TILES * TILE) {
    memory.upHeld = false;
    return 1;
  }
  // Level with it: a held Up after a flap glides; never a new press, which would flap.
  const glide = memory.upHeld && dy < TILE / 2;
  memory.upHeld = glide;
  return glide ? -1 : 0;
}

/**
 * Whether to hold Up this tick to climb: press once the flap is ready and the last flap's rise has
 * slowed, let go the tick before so the press is fresh, and keep gliding while waiting.
 */
function climbPress(world: World, racer: Racer, memory: FlightPilot, dy: number): boolean {
  const extra = flightExtra(effectiveTuning(world));
  const motion = flightMotion(racer.motion);
  const wantsFlap = dy < -CLIMB_MARGIN && racer.body.vy > -extra.flapLift * FLAP_AGAIN_RISE;
  // The cooldown counts down before the flap is tried, so a press at 1 flaps.
  const ready = motion.flapCooldown <= 1;
  const up = wantsFlap && ready ? !memory.upHeld : memory.upHeld && !ready;
  memory.upHeld = up;
  return up;
}

/** Left, right or nothing: toward the target's column, easing off as it lines up so momentum doesn't carry it past. */
function horizontalStick(world: World, racer: Racer, dx: number): number {
  const { cruise } = flightExtra(effectiveTuning(world));
  const wanted = Math.max(-cruise, Math.min(cruise, dx * APPROACH_GAIN));
  const vx = racer.body.vx;
  if (vx < wanted - SPEED_SLACK) return 1;
  if (vx > wanted + SPEED_SLACK) return -1;
  return 0;
}

function unitToward(from: Vec, to: Vec): Vec {
  const distance = length(to.x - from.x, to.y - from.y);
  return distance === 0 ? { x: 0, y: 0 } : { x: (to.x - from.x) / distance, y: (to.y - from.y) / distance };
}
