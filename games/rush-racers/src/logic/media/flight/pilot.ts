/**
 * Flight's rival pilot: fly toward a point a few tiles along the way, flapping with real presses
 * (Up let go between flaps, pressed only once the flap is ready) while below it, holding Up after a
 * flap to glide down to it while above it, diving when it is more than DIVE_BELOW_TILES below, and
 * dashing on aligned straights as `kickSkill` allows. With a dash ready and a puff cloud blocking a
 * shorter way, it may follow the ram field instead and dash sideways into the cloud, holding toward
 * it without replanning until the cloud pops or the dash's window ends. It reads the way again every `reactionTicks` (at once when knocked far from its
 * target), puts the profile's `wobble` on that point as an altitude and aim jitter (never on the
 * stick, so it never flaps by accident), and on `forceRecover` backs off and flaps up for a beat.
 * Its memory is a `FlightPilot` (`way-data.ts`).
 */
import { tileOf } from '../../ai/steer.ts';
import { isSolid } from '../../level/query.ts';
import { length } from '../../num.ts';
import { canDash } from '../../powerups/dash-meter.ts';
import { centreOf } from '../../racers.ts';
import { type MoveModifiers, type Racer, TILE, type Vec, type World } from '../../types.ts';
import { effectiveTuning } from '../index.ts';
import type { AiDraws, Steering } from '../types.ts';
import { flightMotion } from './data.ts';
import { flightCoralAhead, flightCornerAhead, flightPuffInDashLine, flightRouteDistanceAt } from './way.ts';
import {
  type FlightPilot,
  type FlightPilotNumbers,
  type FlightRoute,
  flightPilot,
  flightPilotNumbers,
} from './way-data.ts';

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
/** Share of the height jitter put on the target's reach. */
const WOBBLE_REACH_SHARE = 0.5;
/** Px/s of horizontal speed wanted per px of distance to the target, so it slows as it lines up. */
const APPROACH_GAIN = 6;
/** Px/s either side of the wanted horizontal speed where it lets go of the stick. */
const SPEED_SLACK = 10;
/** Its aim must be this close to level for a dash on a straight. */
const DASH_ALIGN = 0.9;
/** Tiles ahead on the ram field within which a puff cloud makes it keep its dash for the cloud. */
const KEEP_DASH_TILES = 12;
/** Tiles the ram field must save over the steer field before it will dash through a puff cloud. */
const RAM_SAVING_TILES = 4;
/**
 * Ticks after a dash at a puff cloud before it may choose the ram field again: long enough to fly
 * the long way round a cloud that held, so it doesn't turn back to dash at it again.
 */
const RAM_REST_TICKS = 600;

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
    waypoint: null,
    route: 'steer',
    ramRestTicks: 0,
    puffDash: null,
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
  mods: MoveModifiers,
  draws: AiDraws,
  forceRecover: boolean,
): Steering {
  const ai = racer.ai;
  if (!ai) throw new Error(`flight.steer needs AI memory, but racer '${racer.id}' has none (a human drives it)`);
  const memory = flightPilot(ai.pilot);
  const numbers = flightPilotNumbers(effectiveTuning(world), mods);
  if (memory.ramRestTicks > 0) memory.ramRestTicks--;
  const puff = puffStillDashedAt(world, memory);
  if (puff) return holdTowardPuff(racer, memory, numbers, puff);
  followWay(world, racer, memory, draws);
  if (forceRecover && memory.recoverTicks === 0) {
    memory.recoverTicks = RECOVER_TICKS;
    memory.recoverDir = memory.aim.x > 0 ? -1 : 1;
  }
  if (memory.recoverTicks > 0) return recoveryStep(racer, memory, numbers);
  return flyToTarget(world, racer, memory, numbers, draws.kick);
}

/** Replans when its reaction comes round or it is lost, else counts down; then aims at the target. */
function followWay(world: World, racer: Racer, memory: FlightPilot, draws: AiDraws): void {
  const centre = centreOf(racer);
  const lost = length(memory.target.x - centre.x, memory.target.y - centre.y) > LOST_TILES * TILE;
  if (memory.replanIn <= 0 || lost) replan(world, racer, memory, draws, lost);
  else memory.replanIn--;
  memory.aim = unitToward(centre, memory.target);
}

/**
 * Reads the way again: picks a field and the waypoint `LOOKAHEAD_TILES` along it (or keeps the old
 * one), then sets the target on it, jittered by the profile's wobble.
 */
function replan(world: World, racer: Racer, memory: FlightPilot, draws: AiDraws, lost: boolean): void {
  const tile = tileOf(centreOf(racer));
  const route = choosesRam(world, racer, memory, tile, draws.kick) ? 'ram' : 'steer';
  const ahead = flightCornerAhead(world, tile, LOOKAHEAD_TILES, route);
  const kept = lost || route !== memory.route ? null : furtherAlong(world, route, memory.waypoint, ahead);
  memory.route = route;
  memory.waypoint = kept ?? ahead;
  const jitter = (draws.wobble * 2 - 1) * racer.profile.wobble * WOBBLE_TILES * TILE;
  memory.target = {
    x: (memory.waypoint.x + 0.5) * TILE + jitter * WOBBLE_REACH_SHARE,
    y: (memory.waypoint.y + 0.5) * TILE + jitter,
  };
  memory.replanIn = Math.max(0, racer.profile.reactionTicks - 1);
}

/**
 * The old waypoint when it is further along `route` than the new one, else null. A flyer that bobs
 * back up a shaft it was leaving reads a waypoint behind the one it already had; keeping the old
 * one stops it turning back to the corner over and over.
 */
function furtherAlong(world: World, route: FlightRoute, old: Vec | null, ahead: Vec): Vec | null {
  if (!old) return null;
  const oldDistance = flightRouteDistanceAt(world, old, route);
  return oldDistance < flightRouteDistanceAt(world, ahead, route) ? old : null;
}

/**
 * Whether to follow the ram field: a dash is ready, a puff cloud blocks a way at least
 * RAM_SAVING_TILES shorter, and the skill roll passes (once; a rival already ramming keeps at it).
 */
function choosesRam(world: World, racer: Racer, memory: FlightPilot, tile: Vec, roll: number): boolean {
  if (memory.ramRestTicks > 0 || !dashReady(racer)) return false;
  const saving = flightRouteDistanceAt(world, tile, 'steer') - flightRouteDistanceAt(world, tile, 'ram');
  if (!(saving >= RAM_SAVING_TILES)) return false;
  return memory.route === 'ram' || roll < racer.profile.kickSkill;
}

/** One tick of a stuck recovery: back off along `recoverDir` and flap up toward a point a tile above. */
function recoveryStep(racer: Racer, memory: FlightPilot, numbers: FlightPilotNumbers): Steering {
  memory.recoverTicks--;
  const move = { x: memory.recoverDir, y: climbPress(racer, memory, numbers, -TILE) ? -1 : 0 };
  return { move, kick: false, kickHeld: false, aim: memory.aim, recovering: true };
}

/** Flies toward the target: the vertical and horizontal stick, and a dash through a puff cloud or along a straight. */
function flyToTarget(
  world: World,
  racer: Racer,
  memory: FlightPilot,
  numbers: FlightPilotNumbers,
  roll: number,
): Steering {
  const centre = centreOf(racer);
  const tile = tileOf(centre);
  const canRam = memory.route === 'ram' && dashReady(racer);
  const puff = canRam ? flightPuffInDashLine(world, tile, racer.facing, numbers.dashReachTiles) : null;
  if (puff) return dashAtPuff(racer, memory, numbers, puff);
  const vertical = verticalStick(racer, memory, numbers, memory.target.y - centre.y);
  const move = { x: horizontalStick(racer, numbers, memory.target.x - centre.x), y: vertical };
  const kick = memory.route === 'steer' && wantsStraightDash(world, racer, memory, tile, roll);
  return { move, kick, kickHeld: kick, aim: memory.aim, recovering: false };
}

/**
 * Dashes at `puff` and holds toward it for the dash's window (`holdTowardPuff`), then leaves the ram
 * field for RAM_REST_TICKS.
 */
function dashAtPuff(racer: Racer, memory: FlightPilot, numbers: FlightPilotNumbers, puff: Vec): Steering {
  memory.route = 'steer';
  memory.waypoint = null;
  memory.ramRestTicks = RAM_REST_TICKS;
  memory.puffDash = { tile: puff, ticksLeft: numbers.dashTicks };
  return { ...holdTowardPuff(racer, memory, numbers, puff), kick: true, kickHeld: true };
}

/**
 * The puff cloud it is dashing at, while the dash's window is open and the cloud is unbroken. Once
 * either ends it forgets the dash and replans at once, reading the nav rebuilt if the cloud popped.
 */
function puffStillDashedAt(world: World, memory: FlightPilot): Vec | null {
  const dash = memory.puffDash;
  if (!dash) return null;
  dash.ticksLeft--;
  if (dash.ticksLeft > 0 && isSolid(world.level, world.broken, dash.tile.x, dash.tile.y)) return dash.tile;
  memory.puffDash = null;
  memory.replanIn = 0;
  return null;
}

/** Holds the stick toward `puff` (and the vertical stick toward its target), so the dash keeps its facing until the cloud pops. */
function holdTowardPuff(racer: Racer, memory: FlightPilot, numbers: FlightPilotNumbers, puff: Vec): Steering {
  const centre = centreOf(racer);
  const x = Math.sign((puff.x + 0.5) * TILE - centre.x) || racer.facing;
  const y = verticalStick(racer, memory, numbers, memory.target.y - centre.y);
  return { move: { x, y }, kick: false, kickHeld: false, aim: memory.aim, recovering: false };
}

/**
 * Dashes when the dash is ready, it is already flying the way its aim points and close to level,
 * no puff cloud ahead wants the dash kept for it, and the skill roll passes.
 */
function wantsStraightDash(world: World, racer: Racer, memory: FlightPilot, tile: Vec, roll: number): boolean {
  if (!dashReady(racer)) return false;
  if (Math.abs(memory.aim.x) <= DASH_ALIGN || Math.sign(memory.aim.x) !== racer.facing) return false;
  if (flightCoralAhead(world, tile, KEEP_DASH_TILES)) return false;
  return roll < racer.profile.kickSkill;
}

/** The dash is off cooldown and the meter holds a charge. */
function dashReady(racer: Racer): boolean {
  return racer.kickCooldown === 0 && canDash(racer);
}

/**
 * Up (-1), nothing (0) or Down (1): flap with a real press while the target is above, keep holding
 * Up after a flap to glide down to it while it is up to DIVE_BELOW_TILES below, dive when it is further.
 */
function verticalStick(racer: Racer, memory: FlightPilot, numbers: FlightPilotNumbers, dy: number): number {
  if (dy < -CLIMB_MARGIN) return climbPress(racer, memory, numbers, dy) ? -1 : 0;
  if (dy > DIVE_BELOW_TILES * TILE) {
    memory.upHeld = false;
    return 1;
  }
  // A held Up after a flap glides; never a new press, which would flap.
  return memory.upHeld ? -1 : 0;
}

/**
 * Whether to hold Up this tick to climb: press once the flap is ready and the last flap's rise has
 * slowed, let go the tick before so the press is fresh, and keep gliding while waiting.
 */
function climbPress(racer: Racer, memory: FlightPilot, { flapLift }: FlightPilotNumbers, dy: number): boolean {
  const wantsFlap = dy < -CLIMB_MARGIN && racer.body.vy > -flapLift * FLAP_AGAIN_RISE;
  // The cooldown counts down before the flap is tried, so a press at 1 flaps.
  const ready = flightMotion(racer.motion).flapCooldown <= 1;
  const up = wantsFlap && ready ? !memory.upHeld : memory.upHeld && !ready;
  memory.upHeld = up;
  return up;
}

/**
 * Left, right or nothing: toward the target's column, easing off as it lines up so momentum doesn't
 * carry it past. Over cruise toward a far target (after a dash or a dive) it keeps holding on, since
 * air drag bleeds the surplus and pushing back would throw the speed away.
 */
function horizontalStick(racer: Racer, { cruise }: FlightPilotNumbers, dx: number): number {
  const wanted = Math.max(-cruise, Math.min(cruise, dx * APPROACH_GAIN));
  const vx = racer.body.vx;
  if (Math.abs(wanted) === cruise && vx * wanted > cruise * cruise) return Math.sign(wanted);
  if (vx < wanted - SPEED_SLACK) return 1;
  if (vx > wanted + SPEED_SLACK) return -1;
  return 0;
}

/** Unit vector from `from` toward `to`; zero when they meet. */
function unitToward(from: Vec, to: Vec): Vec {
  const distance = length(to.x - from.x, to.y - from.y);
  return distance === 0 ? { x: 0, y: 0 } : { x: (to.x - from.x) / distance, y: (to.y - from.y) / distance };
}
