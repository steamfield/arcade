/**
 * Flight's rival pilot: fly toward a target point with the stick in `stick.ts` (real flap presses,
 * glides, dives, easing across). Every `reactionTicks` (at once when knocked far from its target or
 * through the ring it flew at) it reads the way again and picks the target (`replan.ts`: the way's
 * corner ahead, a bounce pad or a ring, with the profile's `wobble` on it, pulled back short of a
 * storm zone it can't cross yet); a bounce it is dropping into holds the target until it springs.
 * Each tick it passes or follows a slower racer just ahead (`traffic.ts`), leaves the ram way when a
 * flyer it can't pass comes back out of it (the puff cloud held), bends its line around
 * hazards (`avoidHazards`), and dashes through puff clouds and on straights (`dashes.ts`). On
 * `forceRecover` it backs off and flaps up for a beat. Its memory is a `FlightPilot` (`way-data.ts`).
 */
import { avoidHazards } from '../../ai/avoid.ts';
import { tileOf } from '../../ai/steer.ts';
import { length } from '../../num.ts';
import { centreOf } from '../../racers.ts';
import { type MoveModifiers, type Racer, TILE, type Vec, type World } from '../../types.ts';
import { effectiveTuning } from '../index.ts';
import type { AiDraws, Steering } from '../types.ts';
import { bounceStillPlanned } from './bounce-plan.ts';
import { dashAtPuff, dashReady, holdTowardPuff, leaveRam, puffStillDashedAt, wantsStraightDash } from './dashes.ts';
import { replan } from './replan.ts';
import {
  climbPress,
  type FlightPilotNumbers,
  flightPilotNumbers,
  horizontalStick,
  speedStick,
  stopStick,
  verticalStick,
} from './stick.ts';
import { readTraffic, type Traffic } from './traffic.ts';
import { flightPuffInDashLine } from './way.ts';
import { type FlightPilot, flightPilot } from './way-data.ts';

/** Tiles from its target past which it replans at once (it was knocked or put somewhere else). */
const LOST_TILES = 6;
/** Ticks of a stuck recovery: backing off and flapping up. */
const RECOVER_TICKS = 40;
/** Px to one side its target must be before it reads the racers ahead: below that it is climbing or dropping. */
const ACROSS_PX = TILE / 2;

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
    bounce: null,
    bounceRestTicks: 0,
    ring: null,
    ringRoll: null,
    stormHoldX: null,
    pass: null,
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
  if (memory.bounceRestTicks > 0) memory.bounceRestTicks--;
  const puff = puffStillDashedAt(world, memory);
  if (puff) return holdTowardPuff(racer, memory, numbers, puff);
  followWay(world, racer, memory, numbers, draws);
  if (forceRecover && memory.recoverTicks === 0) {
    memory.recoverTicks = RECOVER_TICKS;
    memory.recoverDir = memory.aim.x > 0 ? -1 : 1;
  }
  if (memory.recoverTicks > 0) return recoveryStep(racer, memory, numbers);
  return flyToTarget(world, racer, memory, numbers, draws.kick);
}

/**
 * Replans when its reaction comes round, it is lost, or it has just passed the ring it flew at, else
 * counts down; a bounce it is dropping into holds its target until it springs. Then aims at the target.
 */
function followWay(world: World, racer: Racer, memory: FlightPilot, numbers: FlightPilotNumbers, draws: AiDraws): void {
  const centre = centreOf(racer);
  const lost = length(memory.target.x - centre.x, memory.target.y - centre.y) > LOST_TILES * TILE;
  const throughRing = memory.ring !== null && world.ringsPassed[racer.id].includes(memory.ring);
  const bouncing = bounceStillPlanned(world, racer, memory);
  if (!bouncing && (memory.replanIn <= 0 || lost || throughRing)) replan(world, racer, memory, numbers, draws, lost);
  else memory.replanIn--;
  memory.aim = unitToward(centre, memory.target);
}

/** One tick of a stuck recovery: back off along `recoverDir` and flap up toward a point a tile above. */
function recoveryStep(racer: Racer, memory: FlightPilot, numbers: FlightPilotNumbers): Steering {
  memory.recoverTicks--;
  const move = { x: memory.recoverDir, y: climbPress(racer, memory, numbers, -TILE) ? -1 : 0 };
  return { move, kick: false, kickHeld: false, aim: memory.aim, recovering: true };
}

/**
 * Flies toward the target: a dash at a puff cloud in line on the ram field, else the stick toward
 * the target (raised or lowered to pass a racer, behind one it follows, bent around a hazard) and a
 * dash on a clear straight.
 */
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
  const traffic = trafficAround(world, racer, memory);
  if (traffic.kind === 'oncoming' && memory.route === 'ram') {
    // A flyer coming back out of the ram way means its puff cloud held: go the long way, now.
    leaveRam(memory);
    memory.replanIn = 0;
  }
  const wanted = { x: memory.target.x, y: traffic.kind === 'pass' ? traffic.altitude : memory.target.y };
  const point = clearOfHazards(world, racer, wanted);
  const vertical = verticalStick(racer, memory, numbers, point.y - centre.y);
  const horizontal = horizontalFor(racer, memory, numbers, traffic, point.x - centre.x);
  const free = point === wanted && traffic.kind !== 'follow' && memory.route === 'steer' && !holdingBack(memory);
  const kick = free && wantsStraightDash(world, racer, memory, tile, roll);
  return { move: { x: horizontal, y: vertical }, kick, kickHeld: kick, aim: memory.aim, recovering: false };
}

/**
 * The racer in its way this tick (`readTraffic`), while it flies across toward a target more than
 * ACROSS_PX to one side; nothing (and no pass kept up) while it climbs or drops to a target above or
 * below, or drops onto a bounce pad.
 */
function trafficAround(world: World, racer: Racer, memory: FlightPilot): Traffic {
  const dx = memory.target.x - centreOf(racer).x;
  if (memory.bounce || Math.abs(dx) <= ACROSS_PX) {
    memory.pass = null;
    return { kind: 'clear' };
  }
  return readTraffic(world, racer, memory, dx > 0 ? 1 : -1, memory.target.y);
}

/**
 * `point`, or a point as far away but turned off a hazard in the straight path to it
 * (`avoidHazards`). The same object when the path is clear.
 */
function clearOfHazards(world: World, racer: Racer, point: Vec): Vec {
  const centre = centreOf(racer);
  const aim = unitToward(centre, point);
  const turned = avoidHazards(world, racer, aim);
  if (turned === aim) return point;
  const distance = length(point.x - centre.x, point.y - centre.y);
  return { x: centre.x + turned.x * distance, y: centre.y + turned.y * distance };
}

/**
 * The horizontal stick toward a point `dx` px to the side: hold the leader's pace when following
 * it, brake to a stop at a storm zone's wait point, else ease toward it.
 */
function horizontalFor(
  racer: Racer,
  memory: FlightPilot,
  numbers: FlightPilotNumbers,
  traffic: Traffic,
  dx: number,
): number {
  if (traffic.kind === 'follow') return speedStick(racer, traffic.speed);
  if (memory.stormHoldX !== null) return stopStick(racer, numbers, dx);
  return horizontalStick(racer, numbers, dx);
}

/** It is waiting at a storm zone or dropping onto a bounce pad, where a dash would carry it past. */
function holdingBack(memory: FlightPilot): boolean {
  return memory.stormHoldX !== null || memory.bounce !== null;
}

/** Unit vector from `from` toward `to`; zero when they meet. */
function unitToward(from: Vec, to: Vec): Vec {
  const distance = length(to.x - from.x, to.y - from.y);
  return distance === 0 ? { x: 0, y: 0 } : { x: (to.x - from.x) / distance, y: (to.y - from.y) / distance };
}
