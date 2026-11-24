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
import { activeCannonRide } from '../../setpieces/cannons.ts';
import { type MoveModifiers, type Racer, TILE, type Vec, type World } from '../../types.ts';
import { effectiveTuning } from '../index.ts';
import type { AiDraws, Steering } from '../types.ts';
import { bounceStillPlanned } from './bounce-plan.ts';
import { dashAtPuff, dashReady, holdTowardPuff, leaveRam, puffStillDashedAt, wantsStraightDash } from './dashes.ts';
import { flightMotion } from './data.ts';
import { sampleFlightEnvironment } from './env.ts';
import { replan } from './replan.ts';
import {
  climbPress,
  type FlightPilotNumbers,
  flightPilotNumbers,
  glideStick,
  horizontalStick,
  speedStick,
  stopStick,
  verticalStick,
} from './stick.ts';
import { readTraffic, type Traffic } from './traffic.ts';
import { flightPuffInDashLine, isCannonTile } from './way.ts';
import { type FlightPilot, flightPilot } from './way-data.ts';

/** Tiles from its target past which it replans at once (it was knocked or put somewhere else). */
const LOST_TILES = 6;
/** Px short of its target's column (or any distance past it) at which it has reached that column. */
const ARRIVED_PX = TILE / 2;
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
    heading: 0,
    through: false,
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
    stormHold: null,
    pass: null,
    passRest: null,
  };
}

/**
 * A flight rival's steering this tick. Mutates only its pilot memory. It starts from whether physics
 * last saw Up held. While stunned, trapped or fallen it keeps reading the way but lets go of the
 * stick (`letGo`), except that a puff dash already under way keeps holding toward its cloud until the
 * dash runs out (the racer's status discards that stick, so it changes nothing in play).
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
  if (activeCannonRide(world, racer.id)) {
    // Start a fresh plan at the exit rather than flying back to the mouth, ring or bounce.
    memory.waypoint = null;
    memory.replanIn = 0;
    memory.recoverTicks = 0;
    memory.puffDash = null;
    memory.bounce = null;
    memory.ring = null;
    memory.pass = null;
    return letGo(memory);
  }
  // Physics saw the stick that reached it, which a stun or trap zeroes: a press must start from that.
  memory.upHeld = flightMotion(racer.motion).upWasHeld;
  const numbers = flightPilotNumbers(effectiveTuning(world), mods, sampleFlightEnvironment(world, racer));
  if (memory.ramRestTicks > 0) memory.ramRestTicks--;
  if (memory.bounceRestTicks > 0) memory.bounceRestTicks--;
  const puff = puffStillDashedAt(world, memory);
  if (puff) return holdTowardPuff(racer, memory, numbers, puff);
  followWay(world, racer, memory, numbers, draws);
  if (forceRecover && memory.recoverTicks === 0) {
    memory.recoverTicks = RECOVER_TICKS;
    memory.recoverDir = memory.aim.x > 0 ? -1 : 1;
  }
  if (cannotAct(racer)) return letGo(memory);
  if (memory.recoverTicks > 0) return recoveryStep(racer, memory, numbers);
  return flyToTarget(world, racer, memory, numbers, draws.kick);
}

/**
 * Replans when its reaction comes round, it is lost, it has flown through to the column of a target
 * the way carries on past (a rival that reads the way late keeps going rather than hover there
 * waiting to read it; where the way turns it still waits, so it turns late), or it has just passed
 * the ring it flew at, else counts down; a bounce it is dropping into holds its target until it
 * springs. Then aims at the target.
 */
function followWay(world: World, racer: Racer, memory: FlightPilot, numbers: FlightPilotNumbers, draws: AiDraws): void {
  const centre = centreOf(racer);
  const dx = memory.target.x - centre.x;
  const lost = length(dx, memory.target.y - centre.y) > LOST_TILES * TILE;
  const arrived = memory.through && dx * memory.heading < ARRIVED_PX;
  const throughRing = memory.ring !== null && world.ringsPassed[racer.id].includes(memory.ring);
  const bouncing = bounceStillPlanned(world, racer, memory);
  const due = memory.replanIn <= 0 || lost || arrived || throughRing;
  if (!bouncing && due) replan(world, racer, memory, numbers, draws, lost);
  else memory.replanIn--;
  memory.aim = unitToward(centre, memory.target);
}

/** True while the racer is stunned, trapped or fallen, when its stick reaches no one (`controlledIntent`). */
function cannotAct(racer: Racer): boolean {
  const { stunned, trapped, fallen } = racer.status;
  return stunned > 0 || trapped > 0 || fallen > 0;
}

/**
 * The stick let go and no dash, for a tick it can't act: nothing it would choose (a dash at a puff
 * cloud, leaving the ram way) happens on a tick its input is thrown away, and a recovery waits.
 */
function letGo(memory: FlightPilot): Steering {
  return { move: { x: 0, y: 0 }, kick: false, kickHeld: false, aim: memory.aim, recovering: false };
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
  if (memory.waypoint && isCannonTile(world, memory.waypoint) && !memory.stormHold) {
    const x = stopStick(racer, numbers, memory.target.x - centre.x);
    const y = verticalStick(racer, memory, numbers, memory.target.y - centre.y);
    return { move: { x, y }, kick: false, kickHeld: false, aim: memory.aim, recovering: false };
  }
  const traffic = trafficAround(world, racer, memory, numbers);
  if (traffic.kind === 'oncoming' && memory.route === 'ram') {
    // A flyer coming back out of the ram way means its puff cloud held: go the long way, now.
    leaveRam(memory);
    memory.replanIn = 0;
  }
  const wanted = { x: memory.target.x, y: traffic.kind === 'pass' ? traffic.altitude : memory.target.y };
  const point = clearOfHazards(world, racer, wanted);
  const underLeader = traffic.kind === 'pass' && traffic.flapBelow !== null && centre.y < traffic.flapBelow;
  const vertical = underLeader ? glideStick(memory) : verticalStick(racer, memory, numbers, point.y - centre.y);
  const horizontal = horizontalFor(racer, memory, numbers, traffic, point.x - centre.x, point === wanted);
  const free = point === wanted && traffic.kind !== 'follow' && memory.route === 'steer' && !holdingBack(memory);
  const kick = free && wantsStraightDash(world, racer, memory, tile, roll);
  return { move: { x: horizontal, y: vertical }, kick, kickHeld: kick, aim: memory.aim, recovering: false };
}

/**
 * The racer in its way this tick (`readTraffic`), while it flies across toward a target more than
 * ACROSS_PX to one side or waits at a storm zone (reading the side it will cross to); nothing (and
 * no pass kept up) while it climbs or drops to a target above or below, or drops onto a bounce pad.
 */
function trafficAround(world: World, racer: Racer, memory: FlightPilot, numbers: FlightPilotNumbers): Traffic {
  const dx = memory.target.x - centreOf(racer).x;
  if (memory.bounce || (!memory.stormHold && Math.abs(dx) <= ACROSS_PX)) {
    memory.pass = null;
    return { kind: 'clear' };
  }
  const travel = memory.stormHold?.travel ?? (dx > 0 ? 1 : -1);
  return readTraffic(world, racer, memory, numbers, travel, memory.target);
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
 * The horizontal stick toward a point `dx` px to the side: hold the leader's pace when following it
 * (or, waiting at a storm zone, stop short of it), brake to a stop at a storm zone's wait point,
 * hold on flat out where the way carries on past the point and no hazard bent the line to it
 * (`unbent`), else ease toward it.
 */
function horizontalFor(
  racer: Racer,
  memory: FlightPilot,
  numbers: FlightPilotNumbers,
  traffic: Traffic,
  dx: number,
  unbent: boolean,
): number {
  if (traffic.kind === 'follow' && memory.stormHold) {
    // The racer ahead waits at the same spot: stop behind it, not on it.
    const along = Math.min(dx * traffic.travel, traffic.room);
    return stopStick(racer, numbers, along * traffic.travel);
  }
  if (traffic.kind === 'follow') return speedStick(racer, traffic.speed);
  if (memory.stormHold) return stopStick(racer, numbers, dx);
  if (memory.through && unbent) return memory.heading;
  return horizontalStick(racer, numbers, dx);
}

/** It is waiting at a storm zone or dropping onto a bounce pad, where a dash would carry it past. */
function holdingBack(memory: FlightPilot): boolean {
  return memory.stormHold !== null || memory.bounce !== null;
}

/** Unit vector from `from` toward `to`; zero when they meet. */
function unitToward(from: Vec, to: Vec): Vec {
  const distance = length(to.x - from.x, to.y - from.y);
  return distance === 0 ? { x: 0, y: 0 } : { x: (to.x - from.x) / distance, y: (to.y - from.y) / distance };
}
