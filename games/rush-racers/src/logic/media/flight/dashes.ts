/**
 * When a flight rival dashes. With a dash ready and a puff cloud blocking a way at least
 * RAM_SAVING_TILES shorter, it may follow the ram field and dash sideways into the cloud, holding
 * toward it without replanning until the cloud pops or the dash's window ends; after that it leaves
 * the ram field for a while. Otherwise it dashes on a straight it is already flying level along, as
 * its `kickSkill` allows. Every choice is a roll of the tick's kick draw against `kickSkill`.
 */
import { isSolid } from '../../level/query.ts';
import { canDash } from '../../powerups/dash-meter.ts';
import { centreOf } from '../../racers.ts';
import { type Racer, TILE, type Vec, type World } from '../../types.ts';
import type { Steering } from '../types.ts';
import { type FlightPilotNumbers, verticalStick } from './stick.ts';
import { flightCoralAhead, flightRouteDistanceAt } from './way.ts';
import type { FlightPilot } from './way-data.ts';

/** Its aim must be this close to level for a dash on a straight. */
const DASH_ALIGN = 0.9;
/** Tiles ahead on the ram field within which a puff cloud makes it keep its dash for the cloud. */
const KEEP_DASH_TILES = 12;
/** Tiles the ram field must save over the steer field before it will dash through a puff cloud. */
const RAM_SAVING_TILES = 4;
/**
 * Ticks after a dash at a puff cloud before it may choose the ram field again: long enough to fly
 * the long way round a cloud that held (or that a racer came back from), so it doesn't turn back to
 * dash at it again.
 */
const RAM_REST_TICKS = 600;

/**
 * Whether to follow the ram field from `tile`: a dash is ready, a puff cloud blocks a way at least
 * RAM_SAVING_TILES shorter, and the skill roll passes (once; a rival already ramming keeps at it).
 *
 * @throws {Error} When the world's nav isn't flight's.
 */
export function choosesRam(world: World, racer: Racer, memory: FlightPilot, tile: Vec, roll: number): boolean {
  if (memory.ramRestTicks > 0 || !dashReady(racer)) return false;
  const saving = flightRouteDistanceAt(world, tile, 'steer') - flightRouteDistanceAt(world, tile, 'ram');
  if (!(saving >= RAM_SAVING_TILES)) return false;
  return memory.route === 'ram' || roll < racer.profile.kickSkill;
}

/**
 * Dashes at `puff` and holds toward it for the dash's window (`holdTowardPuff`), then leaves the ram
 * field for RAM_REST_TICKS.
 *
 * @throws {Error} When the racer's motion isn't flight's.
 */
export function dashAtPuff(racer: Racer, memory: FlightPilot, numbers: FlightPilotNumbers, puff: Vec): Steering {
  leaveRam(memory);
  memory.puffDash = { tile: puff, ticksLeft: numbers.dashTicks };
  return { ...holdTowardPuff(racer, memory, numbers, puff), kick: true, kickHeld: true };
}

/** Leaves the ram field for RAM_REST_TICKS: back to the steer field, its waypoint forgotten. */
export function leaveRam(memory: FlightPilot): void {
  memory.route = 'steer';
  memory.waypoint = null;
  memory.ramRestTicks = RAM_REST_TICKS;
}

/**
 * The puff cloud it is dashing at, while the dash's window is open and the cloud is unbroken. Once
 * either ends it forgets the dash and replans at once, reading the nav rebuilt if the cloud popped.
 */
export function puffStillDashedAt(world: World, memory: FlightPilot): Vec | null {
  const dash = memory.puffDash;
  if (!dash) return null;
  dash.ticksLeft--;
  if (dash.ticksLeft > 0 && isSolid(world.level, world.broken, dash.tile.x, dash.tile.y)) return dash.tile;
  memory.puffDash = null;
  memory.replanIn = 0;
  return null;
}

/**
 * Holds the stick toward `puff` (and the vertical stick toward its target), so the dash keeps its
 * facing until the cloud pops.
 *
 * @throws {Error} When the racer's motion isn't flight's.
 */
export function holdTowardPuff(racer: Racer, memory: FlightPilot, numbers: FlightPilotNumbers, puff: Vec): Steering {
  const centre = centreOf(racer);
  const x = Math.sign((puff.x + 0.5) * TILE - centre.x) || racer.facing;
  const y = verticalStick(racer, memory, numbers, memory.target.y - centre.y);
  return { move: { x, y }, kick: false, kickHeld: false, aim: memory.aim, recovering: false };
}

/**
 * Whether to dash on a straight: the dash is ready, it is already flying the way its aim points and
 * close to level, no puff cloud ahead wants the dash kept for it, and the skill roll passes.
 *
 * @throws {Error} When the world's nav isn't flight's.
 */
export function wantsStraightDash(world: World, racer: Racer, memory: FlightPilot, tile: Vec, roll: number): boolean {
  if (!dashReady(racer)) return false;
  if (Math.abs(memory.aim.x) <= DASH_ALIGN || Math.sign(memory.aim.x) !== racer.facing) return false;
  if (flightCoralAhead(world, tile, KEEP_DASH_TILES)) return false;
  return roll < racer.profile.kickSkill;
}

/** The dash is off cooldown and the meter holds a charge. */
export function dashReady(racer: Racer): boolean {
  return racer.kickCooldown === 0 && canDash(racer);
}
